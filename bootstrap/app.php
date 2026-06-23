<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',   // load our API routes (prefixed with /api)
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    // Register broadcasting: load routes/channels.php AND expose /broadcasting/auth.
    // We pass the auth:api middleware so the broadcast-auth endpoint authenticates
    // private-channel subscriptions with the JWT guard (not web sessions).
    ->withBroadcasting(
        __DIR__.'/../routes/channels.php',
        ['middleware' => ['auth:api']],
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Route-middleware aliases provided by spatie/laravel-permission.
        // These let us write ->middleware('role:seller|admin') in routes/api.php.
        $middleware->alias([
            'role' => \Spatie\Permission\Middleware\RoleMiddleware::class,
            'permission' => \Spatie\Permission\Middleware\PermissionMiddleware::class,
            'role_or_permission' => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
