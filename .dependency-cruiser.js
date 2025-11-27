/** @type {import('dependency-cruiser').IConfiguration} */
export default {
    forbidden: [],
    options: {
        doNotFollow: {
            path: 'node_modules'
        },
        includeOnly: '^src',
        tsPreCompilationDeps: true,
        tsConfig: {
            fileName: './tsconfig.json'
        },
        enhancedResolveOptions: {
            exportsFields: ['exports'],
            conditionNames: ['import', 'require', 'node', 'default']
        },
        reporterOptions: {
            dot: {
                collapsePattern: 'node_modules/[^/]+'
            }
        }
    }
};
