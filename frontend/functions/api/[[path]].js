const allowedMethods = {
    '/api/auth/login': 'POST',
    '/api/auth/session': 'GET',
    '/api/profile': 'GET',
    '/api/chat': 'POST',
    '/api/schedules': 'GET',
    '/api/calendar-events': 'GET',
    '/api/store/items': 'GET',
    '/api/store/inventory': 'GET',
    '/api/store/purchases': 'POST'
};

export async function onRequest({ request, env }) {
    const url = new URL(request.url);
    let allowedMethod = allowedMethods[url.pathname];

    if (url.pathname === '/api/store/items' && request.method === 'POST') {
        allowedMethod = 'POST';
    }
    if (/^\/api\/store\/items\/\d+$/.test(url.pathname)) allowedMethod = 'DELETE';
    if (/^\/api\/store\/inventory\/\d+\/use$/.test(url.pathname)) allowedMethod = 'POST';

    if (!allowedMethod) {
        return Response.json({ detail: 'Not found' }, { status: 404 });
    }

    if (request.method !== allowedMethod) {
        return Response.json(
            { detail: 'Method not allowed' },
            { status: 405, headers: { Allow: allowedMethod } }
        );
    }

    if (!env.BACKEND) {
        return Response.json({ detail: '登录服务尚未绑定' }, { status: 503 });
    }

    return env.BACKEND.fetch(request);
}
