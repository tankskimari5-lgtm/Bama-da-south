import * as T from "three";
export function createHumanMaterials(a, quality = "high") {
  const skin = new T.MeshPhysicalMaterial({
    color: a.skin,
    roughness: 0.57,
    metalness: 0,
    clearcoat: quality === "high" ? 0.035 : 0,
    clearcoatRoughness: 0.6,
  });
  skin.onBeforeCompile = (shader) => {
    shader.vertexShader = "varying vec3 vHumanRest;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvHumanRest=position;",
    );
    shader.fragmentShader =
      `varying vec3 vHumanRest;
 float humanHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
 float humanNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(humanHash(i),humanHash(i+vec3(1,0,0)),f.x),mix(humanHash(i+vec3(0,1,0)),humanHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(humanHash(i+vec3(0,0,1)),humanHash(i+vec3(1,0,1)),f.x),mix(humanHash(i+vec3(0,1,1)),humanHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
 ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
 float mottling=humanNoise(vHumanRest*95.0)-.5;
 float cheek=exp(-pow((abs(vHumanRest.x)-.05)/.035,2.0)-pow((vHumanRest.y-1.66)/.028,2.0));
 float knuckle=exp(-pow((vHumanRest.y-.73)/.035,2.0));
 diffuseColor.rgb*=1.0+mottling*.055;
 diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.045,.935,.91),cheek*.45+knuckle*.25);
 `,
    );
    if (quality === "high")
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
 float pore=humanNoise(vHumanRest*2100.0);
 vec3 poreGradient=vec3(dFdx(pore),dFdy(pore),0.0);normal=normalize(normal+poreGradient*.035);
 `,
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `float softScatter=pow(1.0-clamp(dot(normal,normalize(vViewPosition)),0.0,1.0),3.0);
 outgoingLight+=diffuseColor.rgb*vec3(1.0,.36,.22)*softScatter*.028;
 #include <opaque_fragment>`,
    );
  };
  skin.customProgramCacheKey = () => `human-skin-${quality}-2`;
  const shirt = new T.MeshStandardMaterial({
      color: a.outfit,
      roughness: 0.91,
    }),
    pants = new T.MeshStandardMaterial({
      color: a.pantsColor,
      roughness: 0.93,
    });
  for (const [m, frequency] of [
    [shirt, 570],
    [pants, 680],
  ]) {
    m.onBeforeCompile = (s) => {
      s.vertexShader = "varying vec3 vFabricPoint;\n" + s.vertexShader;
      s.vertexShader = s.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvFabricPoint=position;",
      );
      s.fragmentShader = "varying vec3 vFabricPoint;\n" + s.fragmentShader;
      s.fragmentShader = s.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>\nfloat weave=sin(vFabricPoint.x*${frequency}.0)*sin(vFabricPoint.y*${frequency}.0);diffuseColor.rgb*=1.0+weave*.026;`,
      );
    };
    m.customProgramCacheKey = () => `fabric-${frequency}`;
  }
  const hair = new T.MeshStandardMaterial({
      color: a.hairColor,
      roughness: 0.85,
      metalness: 0,
    }),
    lips = new T.MeshPhysicalMaterial({
      color: new T.Color(a.skin).multiply(new T.Color("#d5aaa1")),
      roughness: 0.44,
      clearcoat: 0.08,
    }),
    crease = new T.MeshStandardMaterial({
      color: new T.Color(a.skin).multiplyScalar(0.38),
      roughness: 0.9,
    }),
    nail = new T.MeshPhysicalMaterial({
      color: new T.Color(a.skin).lerp(new T.Color("#e4c8b5"), 0.3),
      roughness: 0.35,
      clearcoat: 0.15,
    }),
    sclera = new T.MeshPhysicalMaterial({
      color: "#d5d6c9",
      roughness: 0.28,
      clearcoat: 0.2,
      clearcoatRoughness: 0.1,
    }),
    pupil = new T.MeshStandardMaterial({ color: "#0c100e", roughness: 0.24 }),
    iris = new T.MeshPhysicalMaterial({
      color: "#617758",
      roughness: 0.32,
      clearcoat: 0.25,
    });
  iris.onBeforeCompile = (s) => {
    s.vertexShader = "varying vec2 vIrisUV;\n" + s.vertexShader;
    s.vertexShader = s.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvIrisUV=uv;",
    );
    s.fragmentShader = "varying vec2 vIrisUV;\n" + s.fragmentShader;
    s.fragmentShader = s.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>\nfloat angle=vIrisUV.x*6.28318;float radial=vIrisUV.y;float fibers=sin(angle*87.0+radial*89.0)*sin(angle*151.0-radial*47.0);diffuseColor.rgb*=.78+fibers*.18;`,
    );
  };
  const cornea = new T.MeshPhysicalMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.1,
      roughness: 0.05,
      clearcoat: 1,
      depthWrite: false,
    }),
    shoe = new T.MeshStandardMaterial({ color: a.shoeColor, roughness: 0.72 }),
    sole = new T.MeshStandardMaterial({ color: "#c4bfae", roughness: 0.9 }),
    stitch = new T.MeshStandardMaterial({
      color: new T.Color(a.outfit).multiplyScalar(0.78),
      roughness: 1,
    }),
    laces = new T.MeshStandardMaterial({ color: "#e1dece", roughness: 0.95 });
  const all = {
    skin,
    shirt,
    pants,
    hair,
    lips,
    crease,
    nail,
    sclera,
    pupil,
    iris,
    cornea,
    shoe,
    sole,
    stitch,
    laces,
  };
  return {
    ...all,
    dispose() {
      for (const m of Object.values(all)) m.dispose();
    },
  };
}
