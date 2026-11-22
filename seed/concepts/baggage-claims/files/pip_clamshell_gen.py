# ==========================================================================
# Baggage Claims MK1 - PARAMETRIC Print-in-Place Clamshell Generator (Rev A)
# Deps: numpy, scikit-image.   Run: python pip_clamshell_gen.py  -> binary STL
# Target: Bambu Lab A1 / PETG / 0.2 mm layers / supports OFF.
# Voxel R = 0.2 mm; do not coarsen (hinge clearance is 0.4 mm = 2 voxels).
# Print the stepped hinge coupon FIRST (pin_r 1.3/1.4/1.5 vs sock_ir 1.7/1.8/1.9)
# and lock the pair that snaps free after one squeeze per print-in-place practice.
# Latch/post dims are starting points - iterate on machine, not in CAD.
# ==========================================================================
import numpy as np
from skimage import measure

R = 0.2
PARAMS = dict(out_x=90.0, out_y=68.0, wall=2.0, base=2.0, bot_h=26.0, top_h=16.0,
    pin_r=1.4, sock_ir=1.8, sock_or=2.4, hinge_z=20.0,
    strap_w=26.0, strap_slot_h=6.0, post_r=2.5, post_h=6.0, post_hole=0.9,
    latch_w=12.0, latch_hook=1.4)

def ogf(x0,x1,y0,y1,z0,z1): return np.ogrid[x0:x1:R, y0:y1:R, z0:z1:R]
def box(g,x0,x1,y0,y1,z0,z1): return (g[0]>=x0)&(g[0]<=x1)&(g[1]>=y0)&(g[1]<=y1)&(g[2]>=z0)&(g[2]<=z1)
def cylX(g,r,cy,cz,x0,x1): return (((g[1]-cy)**2+(g[2]-cz)**2)<=r*r)&(g[0]>=x0)&(g[0]<=x1)

def build(P):
    P=dict(P); P['hinge_y']=P['out_y']+P['wall']
    w,o,hy,hz,xm = P['wall'],P['out_y'],P['hinge_y'],P['hinge_z'],P['out_x']/2
    g = ogf(-2, P['out_x']+2, -2, hy+0.001, -0.4, max(P['bot_h'], hz+P['sock_or'])+0.8)
    B = box(g,0,P['out_x'],0,o,0,P['bot_h']) & ~box(g,w,P['out_x']-w,w,o,P['base'],P['bot_h']+1.2)
    sw=P['strap_w']
    B &= ~box(g,xm-sw/2,xm+sw/2,0,P['strap_slot_h'],0,P['base'])
    B &= ~box(g,xm-sw/2,xm+sw/2,o-P['strap_slot_h'],o,0,P['base'])
    for px in (6.0, P['out_x']-6.0):
        for py in (8.0, o-8.0):
            d2=(g[0]-px)**2+(g[1]-py)**2
            B |= (d2<=P['post_r']**2)&(g[2]>=P['base'])&(g[2]<=P['base']+P['post_h'])
            B &= ~((d2<=P['post_hole']**2)&(g[2]>=P['base'])&(g[2]<=P['base']+P['post_h']))
    for rx in (10.0, 58.0): B |= box(g,rx-1,rx+1,28,64,P['base'],P['base']+7.0)
    B |= box(g,4,P['out_x']-4,o-w,hy,hz-5,hz+5)          # hinge stem
    B |= cylX(g,P['pin_r'],hy,hz,4,P['out_x']-4)         # hinge pin
    B |= box(g,xm-P['latch_w']/2,xm+P['latch_w']/2,-1.5,0,18,22)  # latch catch lip
    del g
    g2 = ogf(-2,P['out_x']+2,hy-0.4,hy+o+3,-0.4,max(P['top_h']+2.5,hz+P['sock_or'])+0.8)
    T = box(g2,0,P['out_x'],hy+w,hy+o,0,P['top_h']) & ~box(g2,w,P['out_x']-w,hy+2*w,hy+o,2.0,P['top_h']+1)
    for i,gx in enumerate(np.arange(14.0, P['out_x']-14.0, 6.0)):
        for gy in np.arange(hy+20.0+(3.0 if i%2 else 0.0), hy+o-6.0, 5.2):
            T &= ~(((g2[0]-gx)**2+(g2[1]-gy)**2<=1.5**2)&(g2[2]>=0)&(g2[2]<=3.0))   # grille
    d = np.sqrt((g2[1]-hy)**2+(g2[2]-hz)**2)
    T |= (d>P['sock_ir'])&(d<=P['sock_or'])&(g2[0]>=4)&(g2[0]<=P['out_x']-4)&((g2[2]-hz)<=0.75*P['sock_ir'])
    T &= ~(d<=P['sock_ir'])                            # teardrop release gap
    T |= box(g2,4,P['out_x']-4,hy,hy+w+2,12,20); T &= ~(d<=P['sock_or']+0.4)
    T |= box(g2,xm-P['latch_w']/2,xm+P['latch_w']/2,hy+o,hy+o+2,P['top_h'],P['top_h']+4)
    T |= box(g2,xm-P['latch_w']/2,xm+P['latch_w']/2,hy+o+2,hy+o+2+P['latch_hook'],P['top_h']-4,P['top_h'])
    del g2
    return B, T

def to_stl(path, B, T, P):
    def mesh(v, off):
        vs, fs = measure.marching_cubes(np.pad(v.astype(np.uint8),1), level=0.5, spacing=(R,R,R))[:2]
        return vs + np.array(off, np.float32), fs
    Bv,Bf = mesh(B, (-2,-2,-0.4)); Tv,Tf = mesh(T, (-2,P['out_y']+P['wall']-0.4,-0.4))
    verts = np.vstack([Bv,Tv]); faces = np.vstack([Bf, Tf+len(Bv)])
    f32 = verts[faces].astype('<f4').reshape(-1,9)
    e1=f32[:,3:6]-f32[:,0:3]; e2=f32[:,6:9]-f32[:,0:3]
    n=np.cross(e1,e2); ln=np.linalg.norm(n,axis=1); ln[ln==0]=1; n=(n/ln[:,None]).astype('<f4')
    rec=np.zeros(len(f32),dtype=[('n','<f4',3),('v','<f4',9),('a','<u2')]); rec['n']=n; rec['v']=f32
    with open(path,'wb') as f:
        f.write(b'BAGGAGE CLAIMS PIP CLAMSHELL'.ljust(80,b' '))
        f.write(np.uint32(len(f32)).tobytes()); rec.tofile(f)

if __name__=='__main__':
    B,T = build(PARAMS); to_stl('pip_clamshell.stl', B, T, PARAMS); print('STL written')
