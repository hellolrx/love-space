const allowedMethods = {
    '/api/auth/login': 'POST',
    '/api/auth/session': 'GET',
    '/api/profile': 'GET',
    '/api/chat': 'POST',
    '/api/schedules': 'GET, POST',
    '/api/calendar-events': 'GET, POST',
    '/api/check-in': 'GET, POST',
    '/api/notes': 'GET, POST',
    '/api/album/entries': 'GET, POST',
    '/api/store/items': 'GET, POST',
    '/api/store/inventory': 'GET',
    '/api/store/purchases': 'POST'
};

export async function onRequest({ request, env }) {
    const url = new URL(request.url);
    let allowedMethod = allowedMethods[url.pathname];

    if (/^\/api\/schedules\/\d+\/complete$/.test(url.pathname)) allowedMethod = 'POST';
    if (/^\/api\/calendar-events\/\d+\/soothe$/.test(url.pathname)) allowedMethod = 'POST';
    if (/^\/api\/notes\/\d+$/.test(url.pathname)) allowedMethod = 'PATCH, DELETE';
    if (/^\/api\/album\/images\/.+$/.test(url.pathname)) allowedMethod = 'GET';
    if (/^\/api\/store\/items\/\d+$/.test(url.pathname)) allowedMethod = 'DELETE';
    if (/^\/api\/store\/inventory\/\d+\/use$/.test(url.pathname)) allowedMethod = 'POST';

    if (!allowedMethod) {
        return Response.json({ detail: 'Not found' }, { status: 404 });
    }

    if (!allowedMethod.split(', ').includes(request.method)) {
        return Response.json(
            { detail: 'Method not allowed' },
            { status: 405, headers: { Allow: allowedMethod } }
        );
    }

    if (!env.BACKEND) {
        return Response.json({ detail: '后端服务尚未绑定' }, { status: 503 });
    }

    return env.BACKEND.fetch(request);
}
