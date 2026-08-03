export default function AIStar({ size = 24, className = "", strokeWidth = 2 }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M12 2c0 6 3 9 10 10-7 1-10 4-10 10-1-7-4-10-10-10 6-1 9-4 10-10z" />
        </svg>
    );
}
