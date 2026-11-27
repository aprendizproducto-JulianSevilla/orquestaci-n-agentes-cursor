import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    const padre = context.parentURL ?? "";
    const propio = padre.includes("/calidad-software/") && !padre.includes("/node_modules/");
    if (
      propio &&
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      !/\.(?:js|mjs|cjs|json|node|ts|tsx|mts|cts)$/.test(specifier)
    ) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});
