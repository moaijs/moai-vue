import fs from "fs";
import path from "path";
import vue from "rollup-plugin-vue";
import alias from "@rollup/plugin-alias";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import PostCSS from "rollup-plugin-postcss";
import postcssImport from "postcss-import";
import minimist from "minimist";
import { terser } from "rollup-plugin-terser";
import autoprefixer from "autoprefixer";
import typescript from "rollup-plugin-typescript2";
import css from "rollup-plugin-css-only";

const postcssConfigList = [
  postcssImport({
    resolve(id, basedir) {
      // resolve alias @css, @import '@css/style.css'
      // because @css/ has 5 chars
      if (id.startsWith("@css")) {
        return path.resolve("./src/assets/styles/css", id.slice(5));
      }

      // resolve node_modules, @import '~normalize.css/normalize.css'
      // similar to how css-loader's handling of node_modules
      if (id.startsWith("~")) {
        return path.resolve("./node_modules", id.slice(1));
      }

      // resolve relative path, @import './components/style.css'
      return path.resolve(basedir, id);
    }
  }),
  autoprefixer()
];

const argv = minimist(process.argv.slice(2));

const projectRoot = path.resolve(__dirname, ".");

let postVueConfig = [
  // Process only `<style module>` blocks.
  PostCSS({
    modules: {
      generateScopedName: '[local]___[hash:base64:5]',
    },
    include: /&module=.*\.css$/,
  }),
  // Process all `<style>` blocks except `<style module>`.
  PostCSS({ include: /(?<!&module=.*)\.css$/,
    plugins:[
      ...postcssConfigList
    ]
  })
]

if (process.env.SEP_CSS){
  postVueConfig = [css({ output: './dist/bundle.css' }), ...postVueConfig]
}

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
      target: "browser",
      preprocessStyles: !process.env.SEP_CSS,
      postcssPlugins: [...postcssConfigList]
    },
    postVue: [
      ...postVueConfig
    ]
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
        ...baseConfig.plugins.postVue,
        commonjs()
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
      ...baseConfig.plugins.postVue,
      commonjs(),
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
      ...baseConfig.plugins.postVue,
      commonjs(),
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
      commonjs(),
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
      ...baseConfig.plugins.postVue,
      commonjs(),
    ]
  };
  buildFormats.push(cjsConfig);
}

// Export config
export default buildFormats;
