/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable no-undef */
import fs from "fs";
import path from "path";

const destinationFolder = "./app/types/generated";

const files = [
  {
    src: path.join(import.meta.dirname, "../learning-platform-cms/types/generated/contentTypes.d.ts"),
    dest: path.join(import.meta.dirname, `./${destinationFolder}/contentTypes.d.ts`),
  },
  {
    src: path.join(import.meta.dirname, "../learning-platform-cms/types/generated/components.d.ts"),
    dest: path.join(import.meta.dirname, `./${destinationFolder}/components.d.ts`),
  },
];

function copyFile({ src, dest }) {
  const destinationDir = path.dirname(dest);

  // Check if source file exists
  if (!fs.existsSync(src)) {
    console.error(`Source file does not exist: ${src}`);
    process.exit(1);
  }

  // Ensure destination directory exists or create it
  if (!fs.existsSync(destinationDir)) {
    fs.mkdirSync(destinationDir, { recursive: true });
  }

  // Read the source file, modify its content and write to the destination file
  const content = fs.readFileSync(src, "utf8");

  fs.writeFile(dest, content, (err) => {
    if (err) {
      console.error(`Error writing to destination file: ${err}`);
      process.exit(1);
    } else {
      console.log(`File ${src} copied and modified successfully!`);
    }
  });
}

files.forEach((file) => copyFile(file));
