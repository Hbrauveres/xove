/** iPhones, iPods and iPads (an iPad may say it's a Mac, but it has touch): Safari's Share steps (spec 0171). */
export const isApple = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
