/* POLY PROTOCOL — skin.js
   Skinned-mesh runtime for Blender-authored assets (skin_asset_v1):
   loads JSON+bin, plays baked rest-relative TRS clips through a joint
   hierarchy, and uploads a bone palette to the GPU skinning shader.
   Skin matrix per joint:  M_j = world_j * inv(bindWorld_j)
   world_j = world_parent * restLocal_j * poseLocal_j                    */
(() => {
  async function load(base){
    const m = await (await fetch(base + '.json')).json();
    const buf = await (await fetch(base + '.bin')).arrayBuffer();
    const parents = m.joints.map(j => j.parent === null ? -1 : m.joints.findIndex(x => x.name === j.parent));
    m.parents = parents;
    // bind world comes straight from Blender matrix_local (bone → armature, row-major export)
    const bindWorld = new Float32Array(m.joints.length * 16);
    for(let j=0;j<m.joints.length;j++){
      const ml = m.joints[j].matrixLocal;
      if(ml){ // rows→columns transpose
        for(let r=0;r<4;r++) for(let col=0;col<4;col++) bindWorld[j*16+col*4+r] = ml[r*4+col];
      } else {
        const h=m.joints[j].head;
        bindWorld[j*16]=1; bindWorld[j*16+5]=1; bindWorld[j*16+10]=1; bindWorld[j*16+12]=h[0]; bindWorld[j*16+13]=h[1]; bindWorld[j*16+14]=h[2]; bindWorld[j*16+15]=1;
      }
    }
    m.bindWorld = bindWorld;
    // restLocal_j = inv(bindWorld_parent) * bindWorld_j
    const restLocal = new Float32Array(m.joints.length * 16);
    for(let j=0;j<m.joints.length;j++){
      const p = parents[j];
      const pw = p>=0 ? bindWorld.subarray(p*16,p*16+16) : null;
      const M = new Float32Array(16);
      if(pw){
        const inv = invMat2(Array.from(pw));
        mulMat(M, inv, bindWorld.subarray(j*16,j*16+16));
      } else {
        M.set(bindWorld.subarray(j*16,j*16+16));
      }
      restLocal.set(M, j*16);
    }
    m.restLocal = restLocal;
    // inverse bind (single inverse of bindWorld)
    const invBind = new Float32Array(m.joints.length * 16);
    for(let j=0;j<m.joints.length;j++){
      const inv = invMat2(Array.from(bindWorld.subarray(j*16,j*16+16)));
      invBind.set(inv, j*16);
    }
    m.invBind = invBind;
    return { meta: m, verts: new Float32Array(buf), parents };
  }

  function invMat(m){
    const a=m;
    const s0=a[0]*a[5]-a[4]*a[1], s1=a[0]*a[9]-a[8]*a[1], s2=a[0]*a[13]-a[12]*a[1];
    const s3=a[4]*a[9]-a[8]*a[5], s4=a[4]*a[13]-a[12]*a[5], s5=a[8]*a[13]-a[12]*a[9];
    const c5=a[10]*a[15]-a[14]*a[11], c4=a[6]*a[15]-a[14]*a[7], c3=a[6]*a[11]-a[10]*a[7];
    const c2=a[2]*a[15]-a[14]*a[3], c1=a[2]*a[11]-a[10]*a[3], c0=a[2]*a[7]-a[6]*a[3];
    const det=1/(s0*c5-s1*c4+s2*c3+s3*c2-s4*c1+s5*c0);
    return [
      (a[5]*c5-a[9]*c4+a[13]*c3)*det,
      (-(a[1]*c5-a[9]*c2+a[13]*c1))*det,
      (a[1]*c4-a[5]*c2+a[9]*c0)*det,
      (-(a[1]*c3-a[5]*c1+a[9]*c0))*det,
      (-(a[4]*c5-a[8]*c4+a[12]*c3))*det,
      (a[0]*c5-a[8]*c2+a[12]*c1)*det,
      (-(a[0]*c4-a[4]*c2+a[8]*c0))*det,
      (a[0]*c3-a[4]*c1+a[8]*c0)*det,
      (a[4]*s5-a[8]*s4+a[12]*s3)*det,
      (-(a[0]*s5-a[8]*s2+a[12]*s1))*det,
      (a[0]*s4-a[4]*s2+a[8]*s0)*det,
      (-(a[0]*s3-a[4]*s1+a[8]*s0))*det,
      (-(a[4]*s5-a[8]*s4+a[12]*s3))*det,
      (a[0]*s5-a[8]*s2+a[12]*s1)*det,
      (-(a[0]*s4-a[4]*s2+a[8]*s0))*det,
      (a[0]*s3-a[4]*s1+a[8]*s0)*det,
    ];
  }
  function invMat2(m){
    // general 4x4 inverse (cofactor-free gauss-jordan on 16)
    const r=m.map(x=>x), inv=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
    for(let col=0;col<4;col++){
      let piv=col;
      for(let r2=col+1;r2<4;r2++) if(Math.abs(r[r2*4+col])>Math.abs(r[piv*4+col])) piv=r2;
      if(Math.abs(r[piv*4+col])<1e-9) return inv;
      if(piv!==col){ for(let k=0;k<4;k++){ [r[col*4+k],r[piv*4+k]]=[r[piv*4+k],r[col*4+k]]; [inv[col*4+k],inv[piv*4+k]]=[inv[piv*4+k],inv[col*4+k]]; } }
      const d=r[col*4+col];
      for(let k=0;k<4;k++){ r[col*4+k]/=d; inv[col*4+k]/=d; }
      for(let x=0;x<4;x++){ if(x===col)continue; const f=r[x*4+col];
        for(let k=0;k<4;k++){ r[x*4+k]-=f*r[col*4+k]; inv[x*4+k]-=f*inv[col*4+k]; } }
    }
    return inv;
  }
  function ident(o){ for(let i=0;i<16;i++) o[i]=0; o[0]=o[5]=o[10]=o[15]=1; return o; }
  function trs(out, tx,ty,tz, qw,qx,qy,qz, sx,sy,sz){
    const x2=qx+qx, y2=qy+qy, z2=qz+qz;
    const xx=qx*x2, xy=qx*y2, xz=qx*z2, yy=qy*y2, yz=qy*z2, zz=qz*z2;
    const wx=qw*x2, wy=qw*y2, wz=qw*z2;
    out[0]=(1-(yy+zz))*sx; out[1]=(xy+wz)*sx; out[2]=(xz-wy)*sx; out[3]=0;
    out[4]=(xy-wz)*sy; out[5]=(1-(xx+zz))*sy; out[6]=(yz+wx)*sy; out[7]=0;
    out[8]=(xz+wy)*sz; out[9]=(yz-wx)*sz; out[10]=(1-(xx+yy))*sz; out[11]=0;
    out[12]=tx; out[13]=ty; out[14]=tz; out[15]=1;
    return out;
  }
  function mulMat(out, a, b){
    for(let c=0;c<4;c++) for(let r=0;r<4;r++){
      let s=0;
      for(let k=0;k<4;k++) s += a[k*4+r]*b[c*4+k];
      out[c*4+r]=s;
    }
    return out;
  }

  class SkinMesh {
    constructor(gl, asset){
      this.gl=gl; this.asset=asset;
      this.nJoints=asset.meta.joints.length;
      this.count=asset.verts.length/14;
      this.vao=gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      this.vb=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,this.vb);
      gl.bufferData(gl.ARRAY_BUFFER, asset.verts, gl.STATIC_DRAW);
      const str=56;
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,str,0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,3,gl.FLOAT,false,str,12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2,3,gl.FLOAT,false,str,24);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3,1,gl.FLOAT,false,str,36);
      gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4,3,gl.FLOAT,false,str,40);
      gl.bindVertexArray(null);
      this.bones=new Float32Array(this.nJoints*16);
      this._tmp=new Float32Array(this.nJoints*16);
      this._st=new Float32Array(this.nJoints*16);
    }
    assemble(unit){
      const meta=this.asset.meta;
      const n=this.nJoints;
      const clip=meta.clips[unit.clip];
      const order=this._order || (this._order=meta.joints.map(j=>j.name));
      // pose local (rest-relative) — reused buffer, no per-frame alloc
      if(!this._local) this._local=new Float32Array(n*16);
      const local=this._local;
      for(let j=0;j<n;j++){
        const tr=clip ? clip[order[j]] : null;
        if(tr){
          const i=Math.min(tr.length-1, unit.frame);
          const d=tr[i];
          trs(local.subarray(j*16,j*16+16), d[0],d[1],d[2], d[3],d[4],d[5],d[6], d[7],d[8],d[9]);
        } else ident(local.subarray(j*16,j*16+16));
        // world = parentWorld * restLocal * poseLocal
        const p=meta.parents[j];
        const rl=meta.restLocal.subarray(j*16,j*16+16);
        mulMat(this._st.subarray(j*16,j*16+16), rl, local.subarray(j*16,j*16+16));
        if(p>=0){
          mulMat(this._tmp.subarray(j*16,j*16+16), this.bones.subarray(p*16,p*16+16), this._st.subarray(j*16,j*16+16));
        } else {
          this._tmp.set(this._st.subarray(j*16,j*16+16), j*16);
        }
      }
      // skin matrices = world * invBind
      for(let j=0;j<n;j++){
        mulMat(this.bones.subarray(j*16,j*16+16),
          this._tmp.subarray(j*16,j*16+16), meta.invBind.subarray(j*16,j*16+16));
      }
      return this.bones;
    }
  }

  class SkinUnit {
    constructor(mesh){
      this.mesh=mesh; this.meta=mesh.asset.meta;
      this.clip='walk'; this.frame=0; this.time=0; this.fps=this.meta.clipFps||30;
      this.model=new Float32Array(16); ident(this.model);
    }
    setClip(name){ if(this.clip!==name){ this.clip=name; this.frame=0; this.time=0; } }
    update(dt){
      this.time+=dt;
      const clip=this.meta.clips[this.clip];
      if(!clip) return;
      const frames=Object.values(clip)[0].length;
      this.frame=Math.floor(this.time*this.fps)%frames;
      this.mesh.assemble(this);
    }
    draw(gl, prog, proj, view){
      const u=this.mesh;
      if(!u._loc){
        u._loc={
          proj:gl.getUniformLocation(prog,'uProj'),
          view:gl.getUniformLocation(prog,'uView'),
          model:gl.getUniformLocation(prog,'uModel'),
          bones:gl.getUniformLocation(prog,'uBones[0]'),
        };
      }
      gl.bindVertexArray(u.vao);
      gl.useProgram(prog);
      const L=u._loc;
      if(L.proj)gl.uniformMatrix4fv(L.proj,false,proj);
      if(L.view)gl.uniformMatrix4fv(L.view,false,view);
      if(L.model)gl.uniformMatrix4fv(L.model,false,this.model);
      if(L.bones)gl.uniformMatrix4fv(L.bones,false,u.bones);
      gl.drawArrays(gl.TRIANGLES, 0, u.count);
      gl.bindVertexArray(null);
    }
  }

  POLY.Skin = { load, SkinMesh, SkinUnit, trs, matMul:mulMat };
})();
