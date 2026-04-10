import type { NextConfig } from "next";
import melPlugin from "./node_modules/@manifesto-ai/compiler/dist/webpack.js";
import {
  createCompilerCodegen,
  createDomainPlugin,
} from "./node_modules/@manifesto-ai/codegen/dist/index.js";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.plugins ??= [];
    config.plugins.push(
      melPlugin({
        codegen: {
          emit: createCompilerCodegen({
            outDir: ".",
            plugins: [
              createDomainPlugin({
                interfaceName: "TaskFlowDomain",
              }),
            ],
          }),
          timing: "transform",
        },
      }),
    );
    return config;
  },
};

export default nextConfig;
