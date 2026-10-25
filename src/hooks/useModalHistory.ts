import { useEffect, useRef } from 'react';

export interface UseModalHistoryOptions {
  isOpen: boolean;
  onClose: () => void;
  modalKey: string;
  /**
   * Optional custom URL updater.
   * If provided, called with true on open (should push history entry)
   * and false on UI close (should back out the history entry).
   */
  customPush?: () => void;
  customPop?: () => void;
}

/**
 * Custom React hook that connects modal/drawer visibility with the browser History API.
 * 
 * Enables closing open overlays when the user presses the phone's physical or on-screen
 * "Back" button, or performs the Android/iOS swipe-back gesture, without navigating away
 * or leaving the application.
 */
export function useModalHistory({
  isOpen,
  onClose,
  modalKey,
  customPush,
  customPop
}: UseModalHistoryOptions) {
  const isPushedRef = useRef(false);
  const isPoppedByBackButtonRef = useRef(false);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const customPushRef = useRef(customPush);
  customPushRef.current = customPush;

  const customPopRef = useRef(customPop);
  customPopRef.current = customPop;

  useEffect(() => {
    if (!isOpen) return;

    isPoppedByBackButtonRef.current = false;
    const stateId = `${modalKey}_${Date.now()}`;

    // Push history entry so the phone's back button has a step to consume
    if (customPushRef.current) {
      customPushRef.current();
    } else {
      try {
        window.history.pushState({ isModalOverlay: true, modalKey, stateId }, '');
      } catch {
        // Safe fallback for strict iframe policies
      }
    }
    isPushedRef.current = true;

    const handlePopState = () => {
      // User tapped phone back button or swiped back
      isPoppedByBackButtonRef.current = true;
      isPushedRef.current = false;
      onCloseRef.current();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);

      // If the modal was dismissed via UI (X button, click backdrop, submit)
      // and NOT via the physical back button, remove the history entry
      // so we don't leave phantom states in the browser history.
      if (isPushedRef.current && !isPoppedByBackButtonRef.current) {
        isPushedRef.current = false;
        if (customPopRef.current) {
          customPopRef.current();
        } else {
          try {
            window.history.back();
          } catch {
            // Safe fallback
          }
        }
      }
    };
  }, [isOpen, modalKey]);
}
