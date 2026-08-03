import { useCallback, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Fingerprint, ShieldAlert, Smartphone, Trash2 } from 'lucide-react';
import { supabase } from '../config/supabase';
import { crearCredencialBiometrica, mensajeDeError, soportaWebAuthn } from '../config/webauthn';
import { useAuthStore } from '../store/useAuthStore';
import TarjetaAcceso from '../components/acceso/TarjetaAcceso';
import { AvisoError, BotonPrincipal, CampoTexto } from '../components/acceso/piezas';
import Badge from '../components/ui/Badge';
import { showErrorToast, showSuccessToast } from '../store/useToastStore';

/**
 * Registro de factores.
 *
 * No tiene entrada propia: se llega acá con la sesión que dejó el paso de
 * contraseña del proceso de acceso. Una pantalla con su propio formulario de
 * correo y contraseña sería una segunda puerta al sistema, capaz de dar de alta
 * factores sin pasar por la identificación.
 *
 * La biometría se registra ANTES que el autenticador, y el orden no es
 * casual: en cuanto la cuenta tiene un TOTP verificado, Supabase exige una
 * sesión AAL2 para dar de alta una passkey. Registrando primero la biometría,
 * la sesión de contraseña alcanza para las dos.
 */

/** El QR llega como SVG; según la versión puede venir sin el prefijo `data:`. */
function urlDelQr(qr) {
    if (!qr) return '';
    return qr.startsWith('data:') ? qr : `data:image/svg+xml;utf-8,${encodeURIComponent(qr)}`;
}

export default function Enrolamiento() {
    const navigate = useNavigate();
    const setPaso = useAuthStore((s) => s.setPaso);
    const emailDelFlujo = useAuthStore((s) => s.email);

    const [sesion, setSesion] = useState(undefined); // undefined = comprobando
    const [factores, setFactores] = useState({ totp: [], passkeys: [] });
    const [aal, setAal] = useState(null);

    // Alta de biometría
    const [errorPasskey, setErrorPasskey] = useState('');
    const [ocupadoPasskey, setOcupadoPasskey] = useState(false);

    // Alta de autenticador
    const [totpNuevo, setTotpNuevo] = useState(null);
    const [codigo, setCodigo] = useState('');
    const [errorTotp, setErrorTotp] = useState('');
    const [ocupadoTotp, setOcupadoTotp] = useState(false);

    // Elevación a AAL2, necesaria sólo si ya existe un autenticador
    const [factorElegido, setFactorElegido] = useState('');
    const [codigoAal, setCodigoAal] = useState('');
    const [errorAal, setErrorAal] = useState('');
    const [elevando, setElevando] = useState(false);

    const refrescar = useCallback(async () => {
        const [{ data: mfa }, { data: pk }, { data: nivel }] = await Promise.all([
            supabase.auth.mfa.listFactors(),
            supabase.auth.passkey.list(),
            supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        ]);
        setFactores({ totp: mfa?.totp ?? [], passkeys: Array.isArray(pk) ? pk : [] });
        setAal(nivel ?? null);
        setFactorElegido((prev) =>
            prev || (mfa?.totp ?? []).find((f) => f.status === 'verified')?.id || '');
    }, []);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSesion(data.session ?? null);
            if (data.session) refrescar();
        });
    }, [refrescar]);

    const totpVerificados = factores.totp.filter((f) => f.status === 'verified');
    const necesitaElevar = !!aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2';
    const tieneBiometria = factores.passkeys.length > 0;
    const tieneAutenticador = totpVerificados.length > 0;
    const listo = tieneBiometria && tieneAutenticador;

    // ── Biometría ─────────────────────────────────────────────────────────────
    async function registrarPasskey() {
        setOcupadoPasskey(true);
        setErrorPasskey('');

        if (!soportaWebAuthn()) {
            setOcupadoPasskey(false);
            setErrorPasskey('Este dispositivo no admite verificación biométrica.');
            return;
        }

        try {
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
            const traducido = mensajeDeError(err);
            setErrorPasskey(
                err?.message && err.message !== traducido
                    ? `${traducido} (${err.message})`
                    : traducido,
            );
            refrescar();
        } finally {
            setOcupadoPasskey(false);
        }
    }

    async function borrarPasskey(passkeyId) {
        const { error } = await supabase.auth.passkey.delete({ passkeyId });
        if (error) { showErrorToast('No se pudo eliminar', error.message); return; }
        refrescar();
    }

    // ── Autenticador ──────────────────────────────────────────────────────────
    async function iniciarTotp() {
        setOcupadoTotp(true);
        setErrorTotp('');
        const { data, error } = await supabase.auth.mfa.enroll({
            factorType: 'totp',
            issuer: 'Acceso Seguro',
            friendlyName: `Autenticador ${Date.now().toString(36)}`,
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
        showSuccessToast('Autenticador registrado', 'Ya podés usar tus códigos');
        refrescar();
    }

    async function borrarTotp(id) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
        if (error) { showErrorToast('No se pudo eliminar', error.message); return; }
        refrescar();
    }

    // ── Elevación ─────────────────────────────────────────────────────────────
    async function elevarSesion(e) {
        e.preventDefault();
        setElevando(true);
        setErrorAal('');

        const { data: reto, error: errReto } = await supabase.auth.mfa.challenge({ factorId: factorElegido });
        if (errReto) { setElevando(false); setErrorAal(errReto.message); return; }

        const { error } = await supabase.auth.mfa.verify({
            factorId: factorElegido,
            challengeId: reto.id,
            code: codigoAal.trim(),
        });
        setElevando(false);

        if (error) { setErrorAal('Código incorrecto o vencido.'); return; }

        // El token nuevo trae el nivel elevado, pero el cliente puede seguir
        // enviando el anterior hasta que le toque renovarlo.
        await supabase.auth.refreshSession();
        setCodigoAal('');
        refrescar();
    }

    /** Vuelve al proceso de acceso a continuar por donde iba. */
    function continuar() {
        setPaso('biometria');
        navigate('/acceso');
    }

    // ── Render ────────────────────────────────────────────────────────────────
    if (sesion === undefined) {
        return (
            <TarjetaAcceso titulo="Registro de factores">
                <div className="flex justify-center py-8">
                    <div className="w-6 h-6 border-2 border-navy-300/40 border-t-navy-700 rounded-full animate-spin" />
                </div>
            </TarjetaAcceso>
        );
    }

    // Sin sesión no hay nada que registrar: se vuelve al inicio del proceso.
    if (!sesion) return <Navigate to="/acceso" replace />;

    return (
        <TarjetaAcceso
            ancho="max-w-lg"
            titulo="Registro de factores"
            descripcion={emailDelFlujo || sesion.user.email}
        >
            <div className="space-y-7">
                {/* ── Inherencia ───────────────────────────────────────────── */}
                <section>
                    <div className="flex items-center gap-2 mb-3">
                        <Fingerprint size={15} strokeWidth={2.5} className="text-navy-900" />
                        <h3 className="text-[12px] font-bold text-navy-900">Biometría</h3>
                        {tieneBiometria && <Badge tone="exito" className="ml-auto">registrada</Badge>}
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

                    {necesitaElevar ? (
                        <form onSubmit={elevarSesion} className="bg-amber-50/70 border border-amber-200/70 rounded-[20px] p-5 space-y-4">
                            <div className="flex items-start gap-2.5">
                                <ShieldAlert size={15} strokeWidth={2.5} className="text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                                    Para cambiar la biometría necesitás confirmar tu identidad con
                                    el código del autenticador.
                                </p>
                            </div>

                            {totpVerificados.length > 1 && (
                                <select
                                    value={factorElegido}
                                    onChange={(e) => setFactorElegido(e.target.value)}
                                    className="w-full bg-white/70 border border-white/80 rounded-[16px] px-4 py-3 text-[12px] font-semibold text-navy-900 outline-none focus:ring-1 focus:ring-white"
                                >
                                    {totpVerificados.map((f) => (
                                        <option key={f.id} value={f.id}>{f.friendly_name || 'Autenticador'}</option>
                                    ))}
                                </select>
                            )}

                            <AvisoError>{errorAal}</AvisoError>

                            <CampoTexto
                                etiqueta="Código de seis dígitos" icono={Smartphone} type="text"
                                inputMode="numeric" maxLength={6} required placeholder="000000"
                                value={codigoAal}
                                onChange={(e) => setCodigoAal(e.target.value.replace(/\D/g, ''))}
                                className="tracking-[0.4em] text-center"
                            />
                            <BotonPrincipal type="submit" cargando={elevando} disabled={codigoAal.length !== 6}>
                                Confirmar
                            </BotonPrincipal>
                        </form>
                    ) : (
                        <button
                            onClick={registrarPasskey}
                            disabled={ocupadoPasskey}
                            className="w-full bg-white/60 hover:bg-white border border-white/70 hover:border-navy-300 text-navy-700 text-[12px] font-bold py-3 rounded-[18px] transition-all disabled:opacity-50"
                        >
                            {ocupadoPasskey
                                ? 'Esperando al dispositivo…'
                                : tieneBiometria ? 'Registrar otro dispositivo' : 'Registrar biometría'}
                        </button>
                    )}
                </section>

                {/* ── Posesión ─────────────────────────────────────────────── */}
                <section>
                    <div className="flex items-center gap-2 mb-3">
                        <Smartphone size={15} strokeWidth={2.5} className="text-navy-900" />
                        <h3 className="text-[12px] font-bold text-navy-900">Autenticador</h3>
                        {tieneAutenticador && <Badge tone="exito" className="ml-auto">registrado</Badge>}
                    </div>

                    {totpVerificados.map((f) => (
                        <div key={f.id} className="flex items-center gap-3 bg-white/50 border border-white/70 rounded-[18px] px-4 py-3 mb-2">
                            <Check size={14} strokeWidth={3} className="text-emerald-600 shrink-0" />
                            <span className="text-[12px] font-semibold text-navy-900 flex-1 truncate">
                                {f.friendly_name || 'Autenticador'}
                            </span>
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
                                Escaneá el código con tu aplicación de autenticación. Si no se lee,
                                cargá esta clave a mano:
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
                                Activar
                            </BotonPrincipal>
                        </form>
                    ) : (
                        <button
                            onClick={iniciarTotp}
                            disabled={ocupadoTotp}
                            className="w-full bg-white/60 hover:bg-white border border-white/70 hover:border-navy-300 text-navy-700 text-[12px] font-bold py-3 rounded-[18px] transition-all disabled:opacity-50"
                        >
                            {tieneAutenticador ? 'Registrar otro autenticador' : 'Registrar autenticador'}
                        </button>
                    )}
                </section>

                {listo && (
                    <button
                        onClick={continuar}
                        className="w-full bg-navy-700 hover:bg-navy-900 text-white text-[13px] font-bold py-4 rounded-[22px] shadow-btn hover:shadow-btn-hover transition-all flex items-center justify-center gap-3 group"
                    >
                        <span>Continuar</span>
                        <ArrowRight size={16} className="transition-transform group-hover:translate-x-1 duration-500" />
                    </button>
                )}
            </div>
        </TarjetaAcceso>
    );
}
