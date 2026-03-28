import { create } from 'zustand';

type ModalType =
  | 'org-edit'
  | 'contact-add' | 'contact-edit'
  | 'endpoint-add' | 'endpoint-edit'
  | 'certificate-add'
  | 'membership-add' | 'membership-edit'
  | 'approval'
  | 'download'
  | null;

interface ModalState {
  open: ModalType;
  editId: string | null;
  openModal: (type: ModalType, editId?: string | null) => void;
  closeModal: () => void;
}

export const useModals = create<ModalState>((set) => ({
  open: null,
  editId: null,
  openModal: (type, editId = null) => set({ open: type, editId }),
  closeModal: () => set({ open: null, editId: null }),
}));
