// Adaptado de NovTurnIA. Allá el componente estaba cableado a los estados de un
// turno (confirmado / pendiente / cancelado). Acá etiqueta roles y resultados de
// la bitácora, así que recibe el tono y el texto. Los colores son los mismos.

const TONOS = {
    exito: { fondo: 'bg-emerald-50', texto: 'text-emerald-700', punto: 'bg-emerald-500' },
    fallo: { fondo: 'bg-rose-50', texto: 'text-rose-700', punto: 'bg-rose-400' },
    aviso: { fondo: 'bg-amber-50', texto: 'text-amber-700', punto: 'bg-amber-500' },
    neutro: { fondo: 'bg-navy-100', texto: 'text-navy-700', punto: 'bg-navy-500' },
};

export default function Badge({ tone = 'neutro', children, className = '' }) {
    const t = TONOS[tone] ?? TONOS.neutro;
    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${t.fondo} ${t.texto} ${className}`}
        >
            <span className={`w-1.5 h-1.5 rounded-full ${t.punto}`} />
            {children}
        </span>
    );
}
