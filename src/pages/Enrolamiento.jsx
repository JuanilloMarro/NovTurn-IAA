import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Fingerprint, Lock, Mail, Smartphone, Trash2 } from 'lucide-react';
import { supabase } from '../config/supabase';
import { crearCredencialBiometrica, mensajeDeError, soportaWebAuthn } from '../config/webauthn';
import TarjetaAcceso from '../components/acceso/TarjetaAcceso';
import { AvisoError, BotonPrincipal, CampoTexto } from '../components/acceso/piezas';
import Badge from '../components/ui/Badge';
import { showErrorToast, showSuccessToast } from '../store/useToastStore';

/**
 * Registro de factores — PLAN.md §7.
 *
 * Va antes que el login en el orden de ejecución: sin factores registrados no
 * hay nada que verificar después. Basta con una sesión AAL1 (sólo contraseña).
 *
 * `qr_code` viene como SVG. Según los tipos de auth-js 2.111.0 puede llegar sin
 * el prefijo `data:`, así que se lo agregamos si hace falta.
 */
function urlDelQr(qr) {
    if (!qr) return '';
    return qr.startsWith('data:') ? qr : `data:image/svg+xml;utf-8,${encodeURIComponent(qr)}`;
}

export default function Enrolamiento() {
    const [sesion, setSesion] = useState(undefined); // undefined = cargando
    const [factores, setFactores] = useState({ totp: [], passkeys: [] });

    // Formulario de entrada
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorEntrada, setErrorEntrada] = useState('');
    const [entrando, setEntrando] = useState(false);

    // Alta de TOTP
    const [totpNuevo, setTotpNuevo] = useState(null);
    const [codigo, setCodigo] = useState('');
    const [errorTotp, setErrorTotp] = useState('');
    const [ocupadoTotp, setOcupadoTotp] = useState(false);

    // Alta de passkey
    const [errorPasskey, setErrorPasskey] = useState('');
    const [ocupadoPasskey, setOcupadoPasskey] = useState(false);

    const refrescar = useCallback(async () => {
        const [{ data: mfa }, { data: pk }] = await Promise.all([
            supabase.auth.mfa.listFactors(),
            supabase.auth.passkey.list(),
        ]);
        // `passkey.list()` devuelve el arreglo directo (PasskeyListItem[]),
        // no un objeto envolvente. Verificado en los tipos de auth-js 2.111.0.
        setFactores({ totp: mfa?.totp ?? [], passkeys: pk ?? [] });
    }, []);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSesion(data.session);
            if (data.session) refrescar();
        });
    }, [refrescar]);

    async function entrar(e) {
        e.preventDefault();
        setEntrando(true);
        setErrorEntrada('');
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        setEntrando(false);
        if (error) { setErrorEntrada('Correo o contraseña incorrectos.'); return; }
        setSesion(data.session);
        setPassword('');
        refrescar();
    }

    async function salir() {
        await supabase.auth.signOut();
        setSesion(null);
        setTotpNuevo(null);
        setFactores({ totp: [], passkeys: [] });
    }

    // ── TOTP ──────────────────────────────────────────────────────────────────
    async function iniciarTotp() {
        setOcupadoTotp(true);
        setErrorTotp('');
        const { data, error } = await supabase.auth.mfa.enroll({
            factorType: 'totp',
            issuer: 'Acceso Seguro',
            friendlyName: `Autenticador ${new Date().toLocaleDateString('es-GT')} ${Date.now() % 10000}`,
        });
        setOcupadoTotp(false);
        if (error) { setErrorTotp(error.message); return; }
        setTotpNuevo(data);
    }

    async function confirmarTotp(e) {
        e.preventDefault();
        setOcupadoTotp(true);
        setErrorTotp('');

        const { data: reto, error: errReto } = await supabase.auth.mfa.challenge({ factorId: totpNuevo.id });
        if (errReto) { setOcupadoTotp(false); setErrorTotp(errReto.message); return; }

        const { error } = await supabase.auth.mfa.verify({
            factorId: totpNuevo.id,
            challengeId: reto.id,
            code: codigo.trim(),
        });
        setOcupadoTotp(false);

        if (error) { setErrorTotp('Código incorrecto o vencido.'); return; }

        setTotpNuevo(null);
        setCodigo('');
        showSuccessToast('Autenticador registrado', 'El factor de posesión quedó activo');
        refrescar();
    }

    async function borrarTotp(id) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
        if (error) { showErrorToast('No se pudo eliminar', error.message); return; }
        refrescar();
    }

    // ── Passkey ───────────────────────────────────────────────────────────────
    async function registrarPasskey() {
        setOcupadoPasskey(true);
        setErrorPasskey('');

        if (!soportaWebAuthn()) {
            setOcupadoPasskey(false);
            setErrorPasskey('Este navegador no soporta WebAuthn.');
            return;
        }

        try {
            // Ceremonia en dos pasos, no `registerPasskey()`: es la única forma
            // de imponer `authenticatorAttachment: 'platform'` y conseguir que
            // iOS ofrezca Face ID en vez de QR o llave de seguridad.
            // Ver el encabezado de `config/webauthn.js`.
            const { data: reto, error: errReto } = await supabase.auth.passkey.startRegistration();
            if (errReto) throw errReto;

            const credencial = await crearCredencialBiometrica(reto.options);

            const { data, error } = await supabase.auth.passkey.verifyRegistration({
                challengeId: reto.challenge_id,
                credential: credencial,
            });
            if (error) throw error;

            showSuccessToast('Biometría registrada', data?.friendly_name ?? 'Credencial creada');
            refrescar();
        } catch (err) {
            setErrorPasskey(mensajeDeError(err));
        } finally {
            setOcupadoPasskey(false);
        }
    }

    async function borrarPasskey(passkeyId) {
        const { error } = await supabase.auth.passkey.delete({ passkeyId });
        if (error) { showErrorToast('No se pudo eliminar', error.message); return; }
        refrescar();
    }

    // ── Render ────────────────────────────────────────────────────────────────
    if (sesion === undefined) {
        return (
            <TarjetaAcceso titulo="Registro de factores" descripcion="Cargando…">
                <div className="flex justify-center py-8">
                    <div className="w-6 h-6 border-2 border-navy-300/40 border-t-navy-700 rounded-full animate-spin" />
                </div>
            </TarjetaAcceso>
        );
    }

    if (!sesion) {
        return (
            <TarjetaAcceso
                titulo="Registro de factores"
                descripcion="Entrá con tu contraseña para registrar el autenticador y la biometría. Basta una sesión AAL1."
                pie={<Link to="/acceso" className="text-[11px] font-semibold text-navy-700/50 hover:text-navy-900 transition-colors">Ir al proceso de acceso</Link>}
            >
                <form onSubmit={entrar} className="space-y-5">
                    <AvisoError>{errorEntrada}</AvisoError>
                    <CampoTexto
                        etiqueta="Correo electrónico" icono={Mail} type="email" required autoFocus
                        autoComplete="username" placeholder="usuario@accesoseguro.gt"
                        value={email} onChange={(e) => setEmail(e.target.value)}
                    />
                    <CampoTexto
                        etiqueta="Contraseña" icono={Lock} type="password" required
                        autoComplete="current-password" placeholder="••••••••"
                        value={password} onChange={(e) => setPassword(e.target.value)}
                    />
                    <BotonPrincipal type="submit" cargando={entrando}>Entrar</BotonPrincipal>
                </form>
            </TarjetaAcceso>
        );
    }

    return (
        <TarjetaAcceso
            ancho="max-w-lg"
            titulo="Registro de factores"
            descripcion={sesion.user.email}
            pie={
                <div className="flex items-center justify-center gap-5">
                    <Link to="/acceso" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-navy-700/50 hover:text-navy-900 transition-colors">
                        <ArrowLeft size={12} strokeWidth={2.5} /> Ir al proceso de acceso
                    </Link>
                    <button onClick={salir} className="text-[11px] font-semibold text-navy-700/50 hover:text-navy-900 transition-colors">
                        Salir
                    </button>
                </div>
            }
        >
            <div className="space-y-6">
                {/* ── Posesión ─────────────────────────────────────────────── */}
                <section>
                    <div className="flex items-center gap-2 mb-3">
                        <Smartphone size={15} strokeWidth={2.5} className="text-navy-900" />
                        <h3 className="text-[12px] font-bold text-navy-900">Algo que tengo · autenticador TOTP</h3>
                    </div>

                    {factores.totp.filter((f) => f.status === 'verified').map((f) => (
                        <div key={f.id} className="flex items-center gap-3 bg-white/50 border border-white/70 rounded-[18px] px-4 py-3 mb-2">
                            <Check size={14} strokeWidth={3} className="text-emerald-600 shrink-0" />
                            <span className="text-[12px] font-semibold text-navy-900 flex-1 truncate">
                                {f.friendly_name || 'Autenticador'}
                            </span>
                            <Badge tone="exito">activo</Badge>
                            <button onClick={() => borrarTotp(f.id)} className="text-gray-400 hover:text-red-500 transition-colors" aria-label="Eliminar">
                                <Trash2 size={14} strokeWidth={2.2} />
                            </button>
                        </div>
                    ))}

                    <AvisoError>{errorTotp}</AvisoError>

                    {totpNuevo ? (
                        <form onSubmit={confirmarTotp} className="bg-white/50 border border-white/70 rounded-[20px] p-5 space-y-4">
                            <img
                                src={urlDelQr(totpNuevo.totp.qr_code)}
                                alt="Código QR del autenticador"
                                className="w-40 h-40 mx-auto bg-white rounded-[14px] p-2"
                            />
                            <p className="text-[10px] text-gray-500 font-medium text-center leading-relaxed">
                                Escaneá el código con Google Authenticator. Si no se lee, cargá esta clave:
                            </p>
                            <code className="block text-[10px] text-navy-700 font-bold text-center break-all bg-white/70 rounded-[12px] px-3 py-2">
                                {totpNuevo.totp.secret}
                            </code>
                            <CampoTexto
                                etiqueta="Código de seis dígitos" icono={Smartphone} type="text"
                                inputMode="numeric" maxLength={6} required autoFocus placeholder="000000"
                                value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                                className="tracking-[0.4em] text-center"
                            />
                            <BotonPrincipal type="submit" cargando={ocupadoTotp} disabled={codigo.length !== 6}>
                                Activar autenticador
                            </BotonPrincipal>
                        </form>
                    ) : (
                        <button
                            onClick={iniciarTotp}
                            disabled={ocupadoTotp}
                            className="w-full bg-white/60 hover:bg-white border border-white/70 hover:border-navy-300 text-navy-700 text-[12px] font-bold py-3 rounded-[18px] transition-all disabled:opacity-50"
                        >
                            {factores.totp.some((f) => f.status === 'verified')
                                ? 'Registrar otro autenticador'
                                : 'Registrar autenticador'}
                        </button>
                    )}
                </section>

                {/* ── Inherencia ───────────────────────────────────────────── */}
                <section>
                    <div className="flex items-center gap-2 mb-3">
                        <Fingerprint size={15} strokeWidth={2.5} className="text-navy-900" />
                        <h3 className="text-[12px] font-bold text-navy-900">Algo que soy · biometría (passkey)</h3>
                    </div>

                    {factores.passkeys.map((p) => (
                        <div key={p.id} className="flex items-center gap-3 bg-white/50 border border-white/70 rounded-[18px] px-4 py-3 mb-2">
                            <Check size={14} strokeWidth={3} className="text-emerald-600 shrink-0" />
                            <span className="text-[12px] font-semibold text-navy-900 flex-1 truncate">
                                {p.friendly_name || 'Credencial biométrica'}
                            </span>
                            <button onClick={() => borrarPasskey(p.id)} className="text-gray-400 hover:text-red-500 transition-colors" aria-label="Eliminar">
                                <Trash2 size={14} strokeWidth={2.2} />
                            </button>
                        </div>
                    ))}

                    <AvisoError>{errorPasskey}</AvisoError>

                    <button
                        onClick={registrarPasskey}
                        disabled={ocupadoPasskey}
                        className="w-full bg-white/60 hover:bg-white border border-white/70 hover:border-navy-300 text-navy-700 text-[12px] font-bold py-3 rounded-[18px] transition-all disabled:opacity-50"
                    >
                        {ocupadoPasskey ? 'Esperando al autenticador…' : 'Registrar biometría'}
                    </button>

                    <p className="text-[10px] text-gray-400 font-medium text-center leading-relaxed mt-3">
                        La credencial queda amarrada al dominio donde se registra. Si el proyecto se
                        despliega, hay que volver a registrarla ahí (PLAN.md §9.3).
                    </p>
                </section>
            </div>
        </TarjetaAcceso>
    );
}
