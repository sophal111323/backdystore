const fs = require("fs");
const path = require("path");

function patchNext() {
  const root = path.join(__dirname, "..");
  
  // 1. Patch edge-runtime (skip nullable exports check)
  const edgeRuntimeFile = path.join(root, "node_modules", "next", "dist", "compiled", "edge-runtime", "index.js");
  if (fs.existsSync(edgeRuntimeFile)) {
    let edgeCode = fs.readFileSync(edgeRuntimeFile, "utf8");
    const t1 = 'if(!A.exports[r]){throw new Error(`Attempt to export a nullable value for "${r}"`)}';
    const t2 = 'if(!A.exports[t]){throw new Error(`Attempt to export a nullable value for "${t}"`)}';
    const tSubtle = 'else{const e=__nccwpck_require__(601).webcrypto;return{crypto:e,Crypto:e.constructor,CryptoKey:e.CryptoKey,SubtleCrypto:e.subtle.constructor}}';
    const repSubtle = 'else{const w=__nccwpck_require__(601);const e=w?.webcrypto||globalThis?.crypto||{};const s=e?.subtle||{};return{crypto:e,Crypto:e?.constructor||Object,CryptoKey:e?.CryptoKey||Object,SubtleCrypto:s?.constructor||Object}}';
    let edgeChanged = false;
    if (edgeCode.includes(t1)) {
      edgeCode = edgeCode.replace(t1, 'if(!A.exports[r]){continue;}');
      edgeChanged = true;
    }
    if (edgeCode.includes(t2)) {
      edgeCode = edgeCode.replace(t2, 'if(!A.exports[t]){continue;}');
      edgeChanged = true;
    }
    if (edgeCode.includes(tSubtle)) {
      edgeCode = edgeCode.replace(tSubtle, repSubtle);
      edgeChanged = true;
    }
    if (edgeChanged) {
      fs.writeFileSync(edgeRuntimeFile, edgeCode, "utf8");
      console.log("[patch-next] Patched edge-runtime index.js");
    }
  }

  // 2. Patch load-components.js
  const loadCompFile = path.join(root, "node_modules", "next", "dist", "server", "load-components.js");
  if (fs.existsSync(loadCompFile)) {
    let loadCode = fs.readFileSync(loadCompFile, "utf8");
    let loadChanged = false;

    if (loadCode.includes("if (needsManifestsForLegacyReasons) {")) {
      loadCode = loadCode.replace(
        "if (needsManifestsForLegacyReasons) {",
        "if (isAppPath || needsManifestsForLegacyReasons) {"
      );
      loadChanged = true;
    }

    const origFn = `async function loadClientReferenceManifestForPage(distDir, page, attempts) {
    const entryName = page.replace(/%5F/g, '_');
    const manifestPath = (0, _path.join)(/* turbopackIgnore: true */ distDir, 'server', 'app', entryName + '_' + _constants.CLIENT_REFERENCE_MANIFEST + '.js');
    try {
        const context = await evalManifestWithRetries(manifestPath, attempts);
        return context.__RSC_MANIFEST[entryName];
    } catch (err) {
        return undefined;
    }
}`;

    const newFn = `async function loadClientReferenceManifestForPage(distDir, page, attempts) {
    const entryName = page.replace(/%5F/g, '_');
    const cleanEntry = entryName.replace(/^\\/+/, '');
    const candidatePaths = [
        (0, _path.join)(distDir, 'server', 'app', entryName + '_' + _constants.CLIENT_REFERENCE_MANIFEST + '.js'),
        (0, _path.join)(distDir, 'server', 'app', cleanEntry, 'page_' + _constants.CLIENT_REFERENCE_MANIFEST + '.js'),
        (0, _path.join)(distDir, 'server', 'app', 'page_' + _constants.CLIENT_REFERENCE_MANIFEST + '.js'),
        (0, _path.join)(distDir, 'server', 'app', cleanEntry, 'route_' + _constants.CLIENT_REFERENCE_MANIFEST + '.js')
    ];
    for (const p of candidatePaths) {
        try {
            const context = await evalManifestWithRetries(p, attempts);
            if (context && context.__RSC_MANIFEST) {
                const keys = [entryName, entryName + '/page', (entryName.startsWith('/') ? entryName : '/' + entryName) + '/page', '/page', entryName + '/route'];
                for (const k of keys) {
                    if (context.__RSC_MANIFEST[k]) return context.__RSC_MANIFEST[k];
                }
                const vals = Object.values(context.__RSC_MANIFEST);
                if (vals.length > 0) return vals[0];
            }
        } catch (err) {}
    }
    return undefined;
}`;

    if (loadCode.includes(origFn)) {
      loadCode = loadCode.replace(origFn, newFn);
      loadChanged = true;
    }

    if (loadChanged) {
      fs.writeFileSync(loadCompFile, loadCode, "utf8");
      console.log("[patch-next] Patched load-components.js");
    }
  }

  // 3. Patch server.runtime.prod.js
  const serverProdFile = path.join(root, "node_modules", "next", "dist", "compiled", "next-server", "server.runtime.prod.js");
  if (fs.existsSync(serverProdFile)) {
    let sCode = fs.readFileSync(serverProdFile, "utf8");
    const tServer = 'async function iO(e,t,r){let n=t.replace(/%5F/g,"_"),i=(0,E.join)(e,"server","app",n+"_client-reference-manifest.js");try{return(await iP(i,r)).__RSC_MANIFEST[n]}catch(e){return}}';
    const repServer = 'async function iO(e,t,r){let n=t.replace(/%5F/g,"_"),c=n.replace(/^\\/+/,""),P=[(0,E.join)(e,"server","app",n+"_client-reference-manifest.js"),(0,E.join)(e,"server","app",c,"page_client-reference-manifest.js"),(0,E.join)(e,"server","app","page_client-reference-manifest.js"),(0,E.join)(e,"server","app",c,"route_client-reference-manifest.js")];for(let i of P){try{let m=await iP(i,r);if(m&&m.__RSC_MANIFEST){let k=[n,n+"/page",(n.startsWith("/")?n:"/"+n)+"/page","/page",n+"/route"];for(let x of k){if(m.__RSC_MANIFEST[x])return m.__RSC_MANIFEST[x]}let v=Object.values(m.__RSC_MANIFEST);if(v.length>0)return v[0]}}catch(err){}}return}';
    if (sCode.includes(tServer)) {
      sCode = sCode.replace(tServer, repServer);
      fs.writeFileSync(serverProdFile, sCode, "utf8");
      console.log("[patch-next] Patched server.runtime.prod.js");
    }
  }

  // 4. Patch nextConfig invariant error in route modules
  const routeFiles = [
    path.join(root, "node_modules", "next", "dist", "server", "route-modules", "route-module.js"),
    path.join(root, "node_modules", "next", "dist", "esm", "server", "route-modules", "route-module.js"),
  ];
  for (const rf of routeFiles) {
    if (fs.existsSync(rf)) {
      let code = fs.readFileSync(rf, "utf8");
      if (code.includes('if (!nextConfig) {')) {
        code = code.replace(
          'if (!nextConfig) {',
          'if (!nextConfig) { nextConfig = { experimental: {} }; }\n        if (false && !nextConfig) {'
        );
        fs.writeFileSync(rf, code, "utf8");
        console.log(`[patch-next] Patched nextConfig in ${path.basename(rf)}`);
      }
    }
  }

  // 5. Patch nextConfig in compiled next-server runtimes
  const nextServerDir = path.join(root, "node_modules", "next", "dist", "compiled", "next-server");
  if (fs.existsSync(nextServerDir)) {
    for (const f of fs.readdirSync(nextServerDir)) {
      if (f.endsWith(".js")) {
        const full = path.join(nextServerDir, f);
        let code = fs.readFileSync(full, "utf8");
        const t = `if(!nextConfig)throw Object.defineProperty(Error("Invariant: nextConfig couldn't be loaded")`;
        if (code.includes(t)) {
          code = code.replaceAll(
            t,
            `if(!nextConfig)nextConfig={experimental:{}};if(false)throw Object.defineProperty(Error("Invariant: nextConfig couldn't be loaded")`
          );
          fs.writeFileSync(full, code, "utf8");
          console.log(`[patch-next] Patched nextConfig in ${f}`);
        }
      }
    }
  }

  // 6. Patch globalThis.crypto.subtle in all Next.js server runtimes
  const subtleFiles = [
    path.join(root, "node_modules", "next", "dist", "shared", "lib", "router", "utils", "cache-busting-search-param.js"),
    path.join(root, "node_modules", "next", "dist", "esm", "shared", "lib", "router", "utils", "cache-busting-search-param.js"),
  ];
  if (fs.existsSync(nextServerDir)) {
    for (const f of fs.readdirSync(nextServerDir)) {
      if (f.endsWith(".js")) {
        subtleFiles.push(path.join(nextServerDir, f));
      }
    }
  }
  for (const sf of subtleFiles) {
    if (fs.existsSync(sf)) {
      let code = fs.readFileSync(sf, "utf8");
      const target = "globalThis.crypto.subtle.digest(";
      if (code.includes(target)) {
        code = code.replaceAll(
          target,
          "(globalThis.crypto?.subtle || (typeof require !== 'undefined' && require('crypto')?.webcrypto?.subtle) || {digest: async () => new Uint8Array(32)}).digest("
        );
        fs.writeFileSync(sf, code, "utf8");
        console.log(`[patch-next] Patched crypto.subtle in ${path.basename(sf)}`);
      }
    }
  }

  // 7. Patch undefined renderOpts in app-route dev runtimes
  const appRouteFiles = [
    path.join(nextServerDir, "app-route-turbo.runtime.dev.js"),
    path.join(nextServerDir, "app-route.runtime.dev.js"),
    path.join(nextServerDir, "app-route-turbo-experimental.runtime.dev.js"),
    path.join(nextServerDir, "app-route-experimental.runtime.dev.js"),
  ];
  for (const arf of appRouteFiles) {
    if (fs.existsSync(arf)) {
      let code = fs.readFileSync(arf, "utf8");
      let changed = false;
      const tVal = 'cacheComponentsEnabled:renderOpts.cacheComponents,validationLevel:renderOpts.validationLevel';
      const repVal = 'cacheComponentsEnabled:null==renderOpts?void 0:renderOpts.cacheComponents,validationLevel:null==renderOpts?void 0:renderOpts.validationLevel';
      if (code.includes(tVal)) {
        code = code.replaceAll(tVal, repVal);
        changed = true;
      }
      const tAfter = 'afterContext:function(renderOpts){let{waitUntil,onClose,onAfterTaskError}=renderOpts;';
      const repAfter = 'afterContext:function(renderOpts){if(!renderOpts)return;let{waitUntil,onClose,onAfterTaskError}=renderOpts;';
      if (code.includes(tAfter)) {
        code = code.replaceAll(tAfter, repAfter);
        changed = true;
      }
      if (changed) {
        fs.writeFileSync(arf, code, "utf8");
        console.log(`[patch-next] Patched renderOpts in ${path.basename(arf)}`);
      }
    }
  }

  // 8. Patch instantInsights.validationLevel in Next.js build templates
  const insightFiles = [
    path.join(root, "node_modules", "next", "dist", "build", "templates", "app-route.js"),
    path.join(root, "node_modules", "next", "dist", "esm", "build", "templates", "app-route.js"),
    path.join(root, "node_modules", "next", "dist", "build", "templates", "app-page-runtime.js"),
    path.join(root, "node_modules", "next", "dist", "esm", "build", "templates", "app-page-runtime.js"),
    path.join(root, "node_modules", "next", "dist", "build", "templates", "edge-ssr-app.js"),
    path.join(root, "node_modules", "next", "dist", "esm", "build", "templates", "edge-ssr-app.js"),
    path.join(root, "node_modules", "next", "dist", "server", "base-server.js"),
    path.join(root, "node_modules", "next", "dist", "esm", "server", "base-server.js"),
  ];
  for (const inf of insightFiles) {
    if (fs.existsSync(inf)) {
      let code = fs.readFileSync(inf, "utf8");
      const target = "nextConfig.experimental.instantInsights.validationLevel";
      if (code.includes(target)) {
        code = code.replaceAll(target, "nextConfig.experimental?.instantInsights?.validationLevel");
        fs.writeFileSync(inf, code, "utf8");
        console.log(`[patch-next] Patched instantInsights in ${path.basename(inf)}`);
      }
    }
  }
}

patchNext();
