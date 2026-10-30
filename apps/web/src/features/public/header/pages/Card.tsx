import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick, style, ...props }) => {
    return (
        <div
            {...props}
            onClick={onClick}
            className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${className}`}
            style={style}
        >
            {children}
        </div>
    );
};
