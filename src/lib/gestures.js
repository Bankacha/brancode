// A bottom sheet dragged down closes after a long drag or a quick flick;
// otherwise it snaps back.
export const shouldDismissDrag = (dy, ms) => dy > 96 || (dy > 24 && dy / ms > 0.6);
