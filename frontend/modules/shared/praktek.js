export function render(data, container) {
    const media = data.imageUrl
        ? ((/\.(glb|gltf)$/i.test(data.imageUrl))
            ? `<model-viewer src="${esc(data.imageUrl)}" auto-rotate camera-controls shadow-intensity="1" exposure="0.8"></model-viewer>`
            : `<img src="${esc(data.imageUrl)}" alt="Praktek Kerja" style="width:100%;height:100%;object-fit:cover;display:block"/>`)
        : null;
    container.innerHTML = media
        ? `<div class="diagram-box">${media}</div>`
        : '';
}
function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
