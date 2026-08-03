export default function Button({ children, variant = 'primary', className = '', ...props }) {
    const base = "transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed";

    if (variant === 'ghost') {
        return (
            <button className={`bg-white/70 hover:bg-white border border-white/60 hover:border-navy-300 text-gray-600 hover:text-navy-700 text-sm font-medium px-5 py-2.5 rounded-full ${base} ${className}`} {...props}>
                {children}
            </button>
        );
    }

    return (
        <button className={`bg-navy-700 hover:bg-navy-900 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-btn hover:shadow-btn-hover hover:-translate-y-px ${base} ${className}`} {...props}>
            {children}
        </button>
    );
}
