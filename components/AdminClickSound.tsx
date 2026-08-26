"use client";

import { useEffect } from "react";

const SOUND_SRC = "/sounds/admin-click.wav";
const POOL_SIZE = 6;
const MIN_GAP_MS = 42;

let mountedInstances = 0;
let cleanupClickSound: (() => void) | null = null;

function isClickableTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;

  const clickable = target.closest(
    [
      "a",
      "button",
      "[role='button']",
      "input[type='button']",
      "input[type='submit']",
      "input[type='reset']",
      ".admin-sound-click",
    ].join(","),
  );

  if (!clickable) return false;
  if (clickable.closest("[data-click-sound='off']")) return false;
  if (clickable.getAttribute("aria-disabled") === "true") return false;

  if (
    (clickable instanceof HTMLButtonElement || clickable instanceof HTMLInputElement) &&
    clickable.disabled
  ) {
    return false;
  }

  return true;
}

function installClickSound() {
  const pool = Array.from({ length: POOL_SIZE }, () => {
    const audio = new Audio(SOUND_SRC);
    audio.preload = "auto";
    audio.volume = 1.0;
    return audio;
  });

  let index = 0;
  let lastPlayed = 0;

  const play = () => {
    const now = performance.now();
    if (now - lastPlayed < MIN_GAP_MS) return;

    lastPlayed = now;

    const audio = pool[index % pool.length];
    index += 1;
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Browser autoplay rules can block sound until the first real user action.
    });
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    if (isClickableTarget(event.target)) play();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (isClickableTarget(event.target)) play();
  };

  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("keydown", onKeyDown, true);

  return () => {
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("keydown", onKeyDown, true);
    pool.forEach((audio) => {
      audio.pause();
      audio.src = "";
    });
  };
}

export default function AdminClickSound() {
  useEffect(() => {
    mountedInstances += 1;

    if (!cleanupClickSound) {
      cleanupClickSound = installClickSound();
    }

    return () => {
      mountedInstances = Math.max(0, mountedInstances - 1);

      if (mountedInstances === 0 && cleanupClickSound) {
        cleanupClickSound();
        cleanupClickSound = null;
      }
    };
  }, []);

  return null;
}
