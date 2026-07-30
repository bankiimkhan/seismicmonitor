import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'Seismic Monitor',
        short_name: 'Seismic',
        description: 'Real-time worldwide earthquake monitoring',
        start_url: '/',
        display: 'standalone',
        background_color: '#0a0b0d',
        theme_color: '#4f6df5',
        icons: [
            { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
    };
}
