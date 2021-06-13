import fs from "fs";
import path from "path";
import vue from "rollup-plugin-vue";
import alias from "@rollup/plugin-alias";
import resolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import minimist from "minimist";
import { terser } from "rollup-plugin-terser";
import typescript from "rollup-plugin-typescript2";

const argv = minimist(process.argv.slice(2));

const projectRoot = path.resolve(__dirname, ".");

const baseConfig = {
  plugins: {
    preVue: [
      alias({
        entries: [
          {
            find: "@",
            replacement: `${path.resolve(projectRoot, "src")}`
          }
        ],
        customResolver: resolve({
          extensions: [".js", ".jsx", ".vue"]
        })
      })
    ],
    replace: {
      "process.env.NODE_ENV": JSON.stringify("production"),
      __VUE_OPTIONS_API__: JSON.stringify(true),
      __VUE_PROD_DEVTOOLS__: JSON.stringify(false),
      preventAssignment: true
    },
    vue: {
      target: "browser"
    },
    postVue: []
  }
};

// ESM/UMD/IIFE shared settings: externals
// Refer to https://rollupjs.org/guide/en/#warning-treating-module-as-external-dependency
const external = [
  // list external dependencies, exactly the way it is written in the import statement.
  // eg. 'jquery'
  "vue"
];

// UMD/IIFE shared settings: output.globals
// Refer to https://rollupjs.org/guide/en#output-globals for details
const globals = {
  // Provide global variable names to replace your external imports
  // eg. jquery: '$'
  vue: "Vue"
};

const baseFolder = "./src/";
const componentsFolder = "components/";

const components = fs
  .readdirSync(baseFolder + componentsFolder)
  .filter(f =>
    fs.statSync(path.join(baseFolder + componentsFolder, f)).isDirectory()
  );

const entriesPath = {
  index: "./src/index.ts",
  ...components.reduce((obj, name) => {
    obj[name] = baseFolder + componentsFolder + name + "/index.ts";
    return obj;
  }, {})
};

const capitalize = s => {
  if (typeof s !== "string") return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
};

let buildFormats = [];

const mapComponent = name => {
  return [
    {
      input: baseFolder + componentsFolder + `${name}/index.ts`,
      external,
      output: {
        format: "umd",
        name: capitalize(name),
        file: `dist/components/${name}/index.ts`,
        exports: "named",
        globals
      },
      plugins: [
        typescript(),
        ...baseConfig.plugins.preVue,
        vue({}),
        ...baseConfig.plugins.postVue
      ]
    }
  ];
};

if (!argv.format || argv.format === "es") {
  const esConfig = {
    input: entriesPath,
    external,
    output: {
      format: "esm",
      dir: "dist/esm"
    },
    plugins: [
      typescript(),
      replace(baseConfig.plugins.replace),
      ...baseConfig.plugins.preVue,
      vue(baseConfig.plugins.vue),
      ...baseConfig.plugins.postVue
    ]
  };

  const merged = {
    input: "src/index.ts",
    external,
    output: {
      format: "esm",
      file: "dist/vuelib.esm.js"
    },
    plugins: [
      typescript(),
      replace(baseConfig.plugins.replace),
      ...baseConfig.plugins.preVue,
      vue(baseConfig.plugins.vue),
      ...baseConfig.plugins.postVue
    ]
  };
  const ind = [
    ...components.map(f => mapComponent(f)).reduce((r, a) => r.concat(a), [])
  ];
  buildFormats.push(esConfig);
  buildFormats.push(merged);
  buildFormats = [...buildFormats, ...ind];
}

if (!argv.format || argv.format === "iife") {
  const unpkgConfig = {
    ...baseConfig,
    input: "./src/index.ts",
    external,
    output: {
      compact: true,
      file: "dist/vuelib-browser.min.js",
      format: "iife",
      name: "vuelib",
      exports: "named",
      globals
    },
    plugins: [
      typescript(),
      replace(baseConfig.plugins.replace),
      ...baseConfig.plugins.preVue,
      vue(baseConfig.plugins.vue),
      ...baseConfig.plugins.postVue,
      terser({
        output: {
          ecma: 5
        }
      })
    ]
  };
  buildFormats.push(unpkgConfig);
}

if (!argv.format || argv.format === "cjs") {
  const cjsConfig = {
    ...baseConfig,
    input: entriesPath,
    external,
    output: {
      compact: true,
      format: "cjs",
      dir: "dist/cjs",
      exports: "named",
      globals
    },
    plugins: [
      typescript(),
      replace(baseConfig.plugins.replace),
      ...baseConfig.plugins.preVue,
      vue({
        ...baseConfig.plugins.vue,
        template: {
          ...baseConfig.plugins.vue.template,
          optimizeSSR: true
        }
      }),
      ...baseConfig.plugins.postVue
    ]
  };
  buildFormats.push(cjsConfig);
}

// Export config
export default buildFormats;
