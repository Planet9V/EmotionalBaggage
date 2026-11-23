// Whether this browser should be given the live 3D tag at all. It needs WebGL, and WebGL drawn by the graphics
// hardware: a software renderer (SwiftShader, llvmpipe, the "basic render driver") takes seconds to compile the
// tag's material and most of a second for each frame, all on the page's own thread, so the page stops answering
// while it draws. There the drawn tag stays, as it does without WebGL. `?film=force` asks for the live tag anyway
// (the screenshot scripts run on a software renderer).
import { filmMode } from "../scenes/pace";

const SOFTWARE = /swiftshader|llvmpipe|software|basic render/i;

export function canDraw3d(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2") ?? document.createElement("canvas").getContext("webgl");
    if (!gl) return false;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return filmMode(window.location.search) === "force" || !SOFTWARE.test(renderer);
  } catch {
    return false;
  }
}
