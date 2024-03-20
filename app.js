const http = require("http");
const chokidar = require("chokidar");
const { minify } = require("terser");
const fs = require("fs").promises;
const sass = require("node-sass");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const processObj = {};

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  const { method, url } = req;
  if (method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      const jsonData = JSON.parse(body);
      cateHandle({
        res,
        url,
        jsonData,
      });
    });
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }
});

const resTemp = (res, data = {}) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
};

const killProcess = (res, id) => {
  const childProcess = processObj[id];
  childProcess?.close();
  delete processObj[id];
  resTemp(res, { code: 200, delete: true });
};

const cateHandle = ({ res, url, jsonData }) => {
  if (url === "/js-watch") {
    if (jsonData?.id) {
      killProcess(res, jsonData.id);
    } else {
      const uniqueID = uuidv4();
      const watcher = chokidar.watch([jsonData.inputVal], {
        ignoreInitial: true,
      });
      watcher.on("change", async (filePath) => {
        if (filePath.endsWith(".js")) {
          await compressJS(filePath, jsonData.outputVal, jsonData?.isCheck);
        }
      });
      processObj[uniqueID] = watcher;
      resTemp(res, { code: 200, id: uniqueID });
    }
  } else if (url === "/scss-watch") {
    if (jsonData?.id) {
      killProcess(res, jsonData.id);
    } else {
      const uniqueID = uuidv4();
      const watcher = chokidar.watch([jsonData.inputVal], {
        ignoreInitial: true,
      });
      watcher.on("change", async (filePath) => {
        if (filePath.endsWith(".scss")) {
          await compileSCSS(filePath, jsonData.outputVal, jsonData?.isCheck);
        }
      });
      processObj[uniqueID] = watcher;
      resTemp(res, { code: 200, id: uniqueID });
    }
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }
};

// 监听 js
const compressJS = async (filePath, jsOutputDir, isCheck = false) => {
  try {
    const fileContent = await fs.readFile(filePath, "utf-8");
    const minified = await minify(fileContent);
    let originalFileName = null;
    if (!isCheck) {
      originalFileName = path.basename(filePath);
    } else {
      originalFileName = path.basename(filePath, path.extname(filePath));
      originalFileName = `${originalFileName}.min.js`;
    }
    await fs.writeFile(path.join(jsOutputDir, originalFileName), minified.code);
    console.log(`文件 ${filePath} 压缩和混淆成功！`);
  } catch (error) {
    console.error(`压缩和混淆文件 ${filePath} 时出错：`, error);
  }
};

// 监听 scss
const compileSCSS = (filePath, cssOutputDir, isCheck = false) => {
  return new Promise((resolve, reject) => {
    const outputFilePath = path.join(
      cssOutputDir,
      path.basename(filePath).replace(".scss", isCheck ? ".min.css" : ".css")
    );
    sass.render(
      {
        file: filePath,
        outputStyle: "compressed",
        outFile: outputFilePath,
      },
      (error, result) => {
        if (!error) {
          fs.writeFile(outputFilePath, result.css)
            .then(() => {
              console.log(`SCSS 文件 ${filePath} 编译成功！`);
              resolve();
            })
            .catch((error) => {
              console.error(
                `写入编译后的 SCSS 文件 ${outputFilePath} 时出错：`,
                error
              );
              reject(error);
            });
        } else {
          console.error(`编译 SCSS 文件 ${filePath} 时出错：`, error);
          reject(error);
        }
      }
    );
  });
};

// 指定服务器监听的端口
const port = 5110;

// 监听指定的端口
server.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://'0.0.0.0':${port}/`);
});
