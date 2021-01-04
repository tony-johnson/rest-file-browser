module.exports = {
    middlewares: [
        function rewriteIndex(context, next) {
          if (context.url.startsWith('/dev/')) {
            context.url = '/dev';
          }

          return next();
        },
      ],
  };