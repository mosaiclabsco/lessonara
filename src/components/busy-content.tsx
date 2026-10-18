import type {ReactNode} from "react";
export function BusyContent({pending,label,children}:{pending:boolean;label?:ReactNode;children:ReactNode}) {
 return <span className="busy-content"><span className="busy-label" aria-hidden={pending} style={{visibility:pending?"hidden":"visible"}}>{children}</span><span className="busy-progress" aria-hidden={!pending} style={{visibility:pending?"visible":"hidden"}}><span className="action-spinner" aria-hidden="true"/>{label??<span className="sr-only">Processando</span>}</span></span>;
}
