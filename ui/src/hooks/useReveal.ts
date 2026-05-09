import { useEffect, useRef, useState } from "react";

export interface RevealOptions {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}

/**
 * Hook that attaches an IntersectionObserver to an element.
 * Toggles the `is-visible` class when the element enters the viewport.
 *
 * Usage:
 *   const ref = useReveal({ threshold: 0.15 });
 *   <div ref={ref} className="reveal-item">...</div>
 */
export function useReveal<T extends HTMLElement>(
  options: RevealOptions = {}
) {
  const { threshold = 0.15, rootMargin = "0px 0px -40px 0px", once = true } = options;
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Skip if user prefers reduced motion
    const motionOK = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (motionOK) {
      // Immediately mark visible without animation
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return { ref, isVisible };
}

/**
 * Hook that reveals multiple children with staggered delays.
 * Pass the count as `count`, then map over children:
 *
 *   const { refs, register } = useRevealList(count);
 *   items.map((item, i) => (
 *     <div key={i} ref={register(i)} className="reveal-child" style={getDelay(i)}>
 *   ))
 */
export function useRevealList(count: number, staggerMs = 60) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);

  // Expand ref array as needed
  if (refs.current.length < count) {
    refs.current = [...refs.current, ...Array(count - refs.current.length).fill(null)];
  }

  useEffect(() => {
    const motionOK = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (motionOK) {
      setVisibleCount(count);
      return;
    }

    if (visibleCount >= count) return;

    const delay = setTimeout(() => {
      setVisibleCount((v) => Math.min(v + 1, count));
    }, staggerMs);

    return () => clearTimeout(delay);
  }, [visibleCount, count, staggerMs]);

  function getDelay(index: number) {
    return { transitionDelay: `${index * staggerMs}ms` };
  }

  function register(index: number) {
    return (el: HTMLElement | null) => {
      refs.current[index] = el;
    };
  }

  const isRevealed = (index: number) => index < visibleCount;

  return { register, getDelay, isRevealed };
}
