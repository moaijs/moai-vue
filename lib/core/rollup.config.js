import fs from "fs";
import path from "path";
import vue from "rollup-plugin-vue";
import alias from "@rollup/plugin-alias";
import resolve from "@rollup/plugin-node-resolve";
import replace from "@rollup/plugin-replace";
import minimist from "minimist";
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

if (!argv.format || argv.format === "cjs") {
  const cjsConfig = {
    ...baseConfig,
    input: entriesPath,
    output: {
      compact: true,
      format: "cjs",
      dir: "dist/cjs",
      exports: "named"
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
