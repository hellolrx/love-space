// Three.js 背景效果
let scene, camera, renderer, particles, material;
let animationId;
let weatherType = 'clear'; // clear, rain, snow, cloudy, starry, storm

export function initBackground() {
    const container = document.getElementById('canvas-container');
    if (!container) return;

    // 1. Setup Scene
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.innerHTML = ''; // Clear existing
    container.appendChild(renderer.domElement);
    
    camera.position.z = 5;

    // 2. Initial Particles (Default Clear)
    createParticles('clear');

    // 3. Animation Loop
    const clock = new THREE.Clock();
    
    function animate() {
        animationId = requestAnimationFrame(animate);
        const t = clock.getElapsedTime();
        
        if (particles) {
            const positions = particles.geometry.attributes.position.array;
            const count = positions.length / 3;

            if (weatherType === 'clear') {
                // 旋转 + 呼吸
                particles.rotation.y = t * 0.05;
                particles.rotation.x = Math.sin(t * 0.1) * 0.1;
            } 
            else if (weatherType === 'starry') {
                // 缓慢旋转，闪烁感强
                particles.rotation.y = t * 0.02;
                particles.rotation.z = t * 0.01;
                // 模拟闪烁 (通过 scale 变化)
                const scale = 1 + Math.sin(t * 2) * 0.1;
                particles.scale.set(scale, scale, scale);
            }
            else if (weatherType === 'rain') {
                // 下落效果
                for(let i=0; i<count; i++) {
                    positions[i*3 + 1] -= 0.2; 
                    if(positions[i*3 + 1] < -10) positions[i*3 + 1] = 10;
                }
                particles.geometry.attributes.position.needsUpdate = true;
            }
            else if (weatherType === 'storm') {
                // 快速下落 + 混乱
                for(let i=0; i<count; i++) {
                    positions[i*3 + 1] -= 0.4; // 更快
                    positions[i*3] += (Math.random() - 0.5) * 0.1; // 抖动
                    if(positions[i*3 + 1] < -10) positions[i*3 + 1] = 10;
                }
                particles.geometry.attributes.position.needsUpdate = true;
                
                // 模拟闪电 (偶尔变亮/变色)
                if (Math.random() < 0.02) {
                    particles.material.color.setHex(0xffffff); // 闪光
                } else {
                    particles.material.color.setHex(0x6366f1); // 恢复深蓝紫
                }
            }
            else if (weatherType === 'snow') {
                // 缓慢飘落 + 左右摇摆
                for(let i=0; i<count; i++) {
                    positions[i*3 + 1] -= 0.02; 
                    positions[i*3] += Math.sin(t + i) * 0.01; 
                    if(positions[i*3 + 1] < -10) positions[i*3 + 1] = 10;
                }
                particles.geometry.attributes.position.needsUpdate = true;
                particles.rotation.y = t * 0.02;
            }
            else if (weatherType === 'cloudy') {
                // 缓慢流动
                particles.rotation.y = t * 0.02;
                particles.rotation.z = Math.sin(t * 0.05) * 0.05;
            }
        }
        
        renderer.render(scene, camera);
    }
    animate();
    
    // Resize Handler
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// 切换天气效果
export function setWeatherEffect(type) {
    console.log('Switching weather to:', type);
    weatherType = type;
    createParticles(type);
}

function createParticles(type) {
    if (particles) {
        scene.remove(particles);
        particles.geometry.dispose();
        particles.material.dispose();
    }

    const geometry = new THREE.BufferGeometry();
    let count = 800;
    let color = 0xf472b6; // Default Pink
    let size = 0.04;
    let opacity = 0.8;
    
    if (type === 'starry') {
        count = 1200;
        color = 0xfcd34d; // Gold/Yellow
        size = 0.03;
        opacity = 0.9;
    } else if (type === 'rain') {
        count = 1500;
        color = 0xa5b4fc; // Blue-ish
        size = 0.08;
        opacity = 0.6;
    } else if (type === 'storm') {
        count = 2000;
        color = 0x6366f1; // Indigo
        size = 0.09;
        opacity = 0.7;
    } else if (type === 'snow') {
        count = 1000;
        color = 0xffffff;
        size = 0.06;
        opacity = 0.9;
    } else if (type === 'cloudy') {
        count = 400;
        color = 0xe5e7eb; // Gray
        size = 0.2; // Big fuzzy dots
        opacity = 0.3;
    }

    const pos = new Float32Array(count * 3);
    for(let i=0; i<count*3; i++) {
        pos[i] = (Math.random() - 0.5) * 20; // Spread out
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    
    material = new THREE.PointsMaterial({ 
        size: size, 
        color: color, 
        transparent: true, 
        opacity: opacity,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending
    });
    
    particles = new THREE.Points(geometry, material);
    scene.add(particles);
}
