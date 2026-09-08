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
    let edgeChanged = false;
    if (edgeCode.includes(t1)) {
      edgeCode = edgeCode.replace(t1, 'if(!A.exports[r]){continue;}');
      edgeChanged = true;
    }
    if (edgeCode.includes(t2)) {
      edgeCode = edgeCode.replace(t2, 'if(!A.exports[t]){continue;}');
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
}

patchNext();
