/**
 * Setup global de Vitest (jsdom): extiende `expect` con los matchers de
 * `@testing-library/jest-dom` (`toBeInTheDocument`, etc.) para todos los
 * archivos de prueba, sin repetir el import en cada uno.
 */
import "@testing-library/jest-dom/vitest";
