import React, { useRef, useEffect } from 'react';

interface Props {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
    className?: string;
    isDone?: boolean;
}

const AutoResizeTextarea: React.FC<Props> = ({ value, onChange, placeholder, className, isDone }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [value]);

    return (
        <textarea
            ref={textareaRef}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            rows={1}
            className={`overflow-hidden resize-none outline-none bg-transparent w-full transition-all ${isDone ? 'line-through opacity-60 text-slate-500' : ''} ${className || ''}`}
        />
    );
};

export default AutoResizeTextarea;