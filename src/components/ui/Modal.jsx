/**
 * Modal genérico.
 *
 * ⚠️ Hoy NO lo importa nadie (verificado: sin import estático, sin `import()`,
 * sin `lazy()`, sin referencia por string). Se conserva como primitiva de la
 * casa, pero por eso mismo tiene que traer ya el arreglo de T27: si alguien lo
 * adopta más adelante, no debe reintroducir el bug que se corrigió en los
 * cuatro modales de formulario.
 *
 * T27 · El velo es `fixed inset-0`, así que la página de atrás no puede
 * desplazarse. Sin un tope de alto, un modal más alto que la pantalla deja su
 * parte de abajo —botones incluidos— fuera de alcance. De ahí el
 * `max-h-[85dvh]` en la tarjeta y el scroll en el cuerpo.
 *
 * El scroll va en el CUERPO y no en la tarjeta para que, cuando se le pase un
 * `footer`, los botones queden fijos abajo y siempre visibles.
 *
 * El tope solo entra en juego cuando el contenido no cabe: con contenido corto
 * el render es idéntico al de antes.
 */
export default function Modal({ children, isOpen, onClose, footer = null }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-navy-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white/95 backdrop-blur-modal border border-white/90 rounded-2xl shadow-modal w-full max-w-md animate-fade-up relative max-h-[85dvh] flex flex-col">
                {onClose && (
                    <button
                        onClick={onClose}
                        aria-label="Cerrar"
                        className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-600"
                    >
                        ✕
                    </button>
                )}

                <div className="p-7 overflow-y-auto">
                    {children}
                </div>

                {footer && (
                    <div className="px-7 pb-7 pt-2 shrink-0">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
