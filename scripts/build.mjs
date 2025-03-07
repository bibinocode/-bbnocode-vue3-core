import chalk from "chalk";
import { execa } from "execa";
import fs from "node:fs";
import { rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

// 获取require方法
const require = createRequire(import.meta.url);

// 获取packages下的所有子包
const allTargets = fs.readdirSync("packages").filter((f) => {
  // 过滤掉非目录文件
  if (!fs.statSync(`packages/${f}`).isDirectory()) {
    return false;
  }
  const pkg = require(`../packages/${f}/package.json`);
  // 过滤掉私有包和不带编译配置的包
  if (pkg.private && !pkg.buildOptions) {
    return false;
  }
  return true;
});

// 方便单独打包可以传递命令行参数
const args = require("minimist")(process.argv.slice(2));
// 如果没有传递命令行参数，就是全部工程
const targets = args._.length ? args._ : allTargets;
const formats = args.formats || args.f;

// 获取到子包之后就可以执行build操作，这里我们借助 execa包 来执行rollup命令
const build = async (target) => {
  const pkgDir = path.resolve(`packages/${target}`);
  const pkg = require(`${pkgDir}/package.json`);

  // 编译前移除之前生成的产物
  await rm(`${pkgDir}/dist`, { recursive: true, force: true });

  // -c 指使用配置文件 默认为rollup.config.js
  // --environment 向配置文件传递环境变量 配置文件通过process.env.获取
  await execa(
    "rollup",
    [
      "-c",
      "--environment", // 传递环境变量
      [
        `TARGET:${target}`,
        formats ? `FORMATS:${formats}` : '', // 使用命令行参数
      ]
        .filter(Boolean)
        .join(","),
    ],
    { stdio: "inherit" },
  );

  // 执行完rollup生成声明文件后
  // package.json中定义此字段时执行，通过api-extractor整合.d.ts文件
  const shouldEmitDeclarations = !!pkg.types;
  if (shouldEmitDeclarations) {
    console.log(
      chalk.bold(chalk.yellow(`Rolling up type definitions for ${target}...`)),
    );
    // 执行API Extractor操作 重新生成声明文件
    const { Extractor, ExtractorConfig } = require("@microsoft/api-extractor");
    const extractorConfigPath = path.resolve(pkgDir, "api-extractor.json");
    const extractorConfig =
      ExtractorConfig.loadFileAndPrepare(extractorConfigPath);
    const extractorResult = Extractor.invoke(extractorConfig, {
      localBuild: true,
      showVerboseMessages: true,
    });
    if (extractorResult.succeeded) {
      console.log("API Extractor completed successfully");
      process.exitCode = 0;
    } else {
      console.error(
        `API Extractor completed with ${extractorResult.errorCount} errors` +
        ` and ${extractorResult.warningCount} warnings`,
      );
      process.exitCode = 1;
    }

    // 删除ts生成的声明文件
    await rm(`${pkgDir}/dist/types/packages`, { recursive: true, force: true });
  }
};

// 同步编译多个包时，为了不影响编译性能，我们需要控制并发的个数，这里我们暂定并发数为4
const maxConcurrency = 4; // 并发编译个数

const buildAll = async () => {
  const ret = [];
  const executing = [];
  for (const item of targets) {
    // 依次对子包执行build()操作
    const p = Promise.resolve().then(() => build(item));
    ret.push(p);

    if (maxConcurrency <= targets.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= maxConcurrency) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
};
// 执行编译操作
buildAll();
