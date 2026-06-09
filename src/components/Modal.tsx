import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ onClose, children }) => {
  const [isBrowser, setIsBrowser] = useState(false);

  useEffect(() => {
    setIsBrowser(true);
  }, []);

  if (!isBrowser) {
    return null;
  }

  const modalContent = (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 transition-transform duration-300 ${
        children ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div
        className={`absolute inset-0 bg-slate-950 opacity-75 transition-opacity duration-300 ${
          children ? "opacity-75" : "opacity-0"
        }`}
        onClick={onClose}
      ></div>
      <div
        className={`relative flex max-h-[88vh] w-full max-w-5xl transform flex-wrap items-center justify-center gap-2 overflow-hidden rounded border border-slate-700 bg-slate-950/95 p-1 shadow-2xl ring-1 ring-black/40 backdrop-blur-md transition-transform duration-300 ease-in-out ${
          children ? "scale-100" : "scale-90"
        }`}
      >
        <div className="z-50 max-h-[86vh] w-full overflow-y-auto rounded-sm border-t-2 border-slate-700 bg-slate-950/95 p-4 text-slate-100 md:p-6">
          {children}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(
    modalContent,
    document.getElementById("modal-hook")!,
  );
};

export default Modal;
