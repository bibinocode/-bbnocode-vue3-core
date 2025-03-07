import json from "@rollup/plugin-json";
import terser from "@rollup/plugin-terser";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "rollup-plugin-typescript2";

// 获取require方法
const require = createRequire(import.meta.url);
// 获取工程绝对路径
const __dirname = fileURLToPath(new URL(".", import.meta.url));
// 获取packages路径
const packagesDir = path.resolve(__dirname, "packages");
const packageDir = path.resolve(packagesDir, process.env.TARGET);

const resolve = (p) => path.resolve(packageDir, p);
// 获取package.json文件
const pkg = require(resolve(`package.json`));
// 获取package.json文件中自定义属性buildOptions
const packageOptions = pkg.buildOptions || {};
// 获取package.json文件名
const name = packageOptions.filename || path.basename(packageDir);

// 定义输出类型对应的编译项
const outputConfigs = {
  "esm-bundler": {
    file: resolve(`dist/${name}.esm-bundler.js`),
    format: `es`,
  },
  "esm-browser": {
    file: resolve(`dist/${name}.esm-browser.js`),
    format: `es`,
  },
  cjs: {
    file: resolve(`dist/${name}.cjs.js`),
    format: `cjs`,
  },
  global: {
    name: name,
    file: resolve(`dist/${name}.global.js`),
    format: `iife`,
  },
};



const defaultFormats = ["esm-bundler", "cjs"];

// 获取rollup传递过来的环境变量process.env.FORMATS
const inlineFormats = process.env.FORMATS?.split(',');

// packageOptions.formats需要在package.json中定义
// 优先查看是否有命令行传递的参数
// 然后查看使用每个包里自定义的formats, 
// 如果没有使用defaultFormats
const packageFormats = inlineFormats || packageOptions.formats || defaultFormats
const packageConfigs = packageFormats.map((format) =>
  createConfig(format, outputConfigs[format])
);

export default packageConfigs;

function createConfig(format, output, plugins = []) {
  // 是否输出声明文件
  const shouldEmitDeclarations = !!pkg.types;

  const isBundlerESMBuild = /esm-bundler/.test(format)
  const isBrowserESMBuild = /esm-browser/.test(format)
  const isNodeBuild = format === 'cjs'
  // 如果format包含global说明是iife导出，设置导出变量名字
  const isGlobalBuild = /global/.test(format)
  if (isGlobalBuild) {
    output.name = packageOptions.name
  }

  const minifyPlugin =
    format === "global" && format === "esm-browser" ? [terser()] : [];

  // nodejs相关的插件处理
  const nodePlugins =
    packageOptions.enableNonBrowserBranches && format !== "cjs"
      ? [
        require("@rollup/plugin-node-resolve").nodeResolve({
          extensions: [".js", "jsx", "ts", "tsx"],
          // preferBuiltins: true,
        }),
        require("@rollup/plugin-commonjs")({
          sourceMap: false,
        }),
      ]
      : [];

  // 处理ts相关插件处理
  const tsPlugin = ts({
    tsconfig: path.resolve(__dirname, "tsconfig.json"),
    tsconfigOverride: {
      compilerOptions: {
        target: format === "cjs" ? "es2019" : "es2015",
        sourceMap: true,
        declaration: true,                    // 确保这个为 true
        declarationMap: true,                 // 如果需要源码映射
        declarationDir: resolve("dist/types"), // 声明文件输出目录
        outDir: resolve("dist")               // 编译输出目录
      },
    },
    useTsconfigDeclarationDir: true,
    clean: true
  });

  const external =
    isGlobalBuild || isBrowserESMBuild
      ? packageOptions.enableNonBrowserBranches
        ? // externalize postcss for @vue/compiler-sfc
        // because @rollup/plugin-commonjs cannot bundle it properly
        ['postcss']
        : // normal browser builds - non-browser only imports are tree-shaken,
        // they are only listed here to suppress warnings.
        ['source-map', '@babel/parser', 'estree-walker']
      : // Node / esm-bundler builds. Externalize everything.
      [
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.peerDependencies || {}),
        ...['path', 'url'] // for @vue/compiler-sfc
      ]

  return {
    input: resolve("src/index.ts"),
    external,
    plugins: [
      json({
        namedExports: false,
      }),
      tsPlugin,
      ...minifyPlugin,
      ...nodePlugins,
      ...plugins,
    ],
    output,
    onwarn: (msg, warn) => {
      if (!/Circular/.test(msg)) {
        warn(msg);
      }
    },
    treeshake: {
      moduleSideEffects: false,
    },
  };
}