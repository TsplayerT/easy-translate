// NOT SUPPORTED ESM (MODULE TYPE)

const fs = require("fs");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const { translate } = require("@vitalets/google-translate-api");

// https://wikipedia.org/wiki/ANSI_escape_code
const COLORS = {
	yellow: "\x1b[33m%s\x1b[0m",
	cyan: "\x1b[36m%s\x1b[0m",
	white: "\x1b[37m%s\x1b[0m",
	red: "\x1b[31m%s\x1b[0m"
};
const DEFAULT_VALUES = {
	outputFileDirectory: "output",
	outputFileExtension: "txt",
	outputDynamicLanguageFolder: true
}
const VALIDATIONS = {
	minimumLevel: (dir, level) => [...dir].filter(x => x === "/").length >= level,
	directoryContains: (dir, object) => {
		const all = !object.all || object.all.every(x => dir.includes(x));
		const any = !object.any || object.any.some(x => dir.includes(x));
		const notAll = !object.notAll || !object.notAll.every(x => dir.includes(x));
		const notAny = !object.notAny || object.notAny.some(x => !dir.includes(x));
	
		return all && any && notAll && notAny;
	}
};

function showConsole(message, enabled, color) {
	const customColor = color || ["string", "array"].includes(typeof message) && /^.*<.*>.*$/.test(message) && COLORS.white || COLORS.cyan;

	enabled && console.log(customColor, message);
}

function getOutputParameters(values) {
	showConsole("function <getOutputParameters>", values.debug);

	const directoryCurrent = values.fileName || values.path;
	const directoryRoot = directoryCurrent.substring(0, directoryCurrent.lastIndexOf('/'));
	const directoryOutput = values.outputFileDirectory === DEFAULT_VALUES.outputFileDirectory ? directoryRoot : values.outputFileDirectory;

	return {
		...values,
		directory: directoryOutput,
		dynamicFolder: values.outputDynamicLanguageFolder,
		name: values.outputFileName,
		extension: values.outputFileExtension || DEFAULT_VALUES.outputFileExtension
	}
}

function showError(error, path) {
	const message = path ? `[${path}]: ${error}` : error;

	error && console.error(message);
}

async function getTranslate(content, language, debug, test) {
	showConsole("function <getTranslate>", debug);

	try {
		const text = test || language === "default" ? content : (await translate(content, { to: language })).text;
		
		showConsole(`[${language}]: ${text}`, debug, COLORS.yellow);
		showConsole(`√ content translated to '${language}'`, true, COLORS.yellow);

		return text;
	} catch (error) {
		if (error.name === "TooManyRequestsError") {
			showConsole("the amount of translations exceeded the free amount in a short period of time of the Google Translate service, please use a VPN", true, COLORS.red);

			return null;
		}
	}
}

async function createDirectory(outputParameters, language, debug, forced) {
	showConsole("function <createDirectory>", debug);

	const { directory, dynamicFolder } = outputParameters;
	const directoryPath = dynamicFolder ? `${directory}/${language}` : directory;
	const directoryExist = fs.existsSync(directoryPath);

	showConsole(`directoryPath: ${directoryPath}`, debug);

	if (!directoryExist || forced) {
		fs.mkdirSync(directoryPath, { recursive: true }, showError);

		showConsole(`√ directory '${directoryPath}' created`, true, COLORS.yellow);
	}

	return directoryPath;
}

async function createFile(outputParameters, directory, language, content, debug, forced) {
	showConsole("function <createFile>", debug);

	const { name, extension } = outputParameters;
	const fileNameExtension = `${name || language}.${extension}`;
	const filePath = `${directory}/${fileNameExtension}`;
	const fileExist = fs.existsSync(filePath);

	showConsole(`filePath: ${filePath}`, debug);

	fs.writeFileSync(filePath, content, { encoding: "utf-8" });
	
	if (!fileExist || forced) {
		showConsole(`√ file '${fileNameExtension}' created`, true, COLORS.yellow);
	}
}

async function multipleTasks(content, languages, outputParameters, debug, index, maxIndex) {
	showConsole("function <multipleTasks>", debug);

	const { forced, test } = outputParameters;

	if (test && (!Boolean(index) || index === 0)) {
		showConsole("=====================================================", true, COLORS.red);
		showConsole("===================== TEST MODE =====================", true, COLORS.red);
		showConsole("=====================================================", true, COLORS.red);
	}

	const array = !languages.includes(",") ? languages.split(" ") : languages.replaceAll(" ", "").split(",");
	const tasks = array.map(async x => new Promise(async resolve => {
		// makes it run as a sequential task	
		setTimeout(async () => {
			const data = await getTranslate(content, x, debug, test)

			if (data) {
				const directory = await createDirectory(outputParameters, x, debug, forced);
	
				await createFile(outputParameters, directory, x, data, debug, forced);
	
				resolve({ [x]: data });
			}
		}, 0)
	}));

	const results = await Promise.all(tasks);

	if (index === maxIndex) {
		showConsole(results, debug);
		showConsole("=====================================================", true, COLORS.yellow);
		showConsole("√ operation completed", true, COLORS.yellow);
	}
}

function basicPathValidation(args, validCallback, invalidMessage) {
	fs.lstat(args.path, async (lstatError, stats) => {
		if (lstatError) {
			showConsole(lstatError.message, true, COLORS.red);
		} else {
			const files = stats.isDirectory() ? fs.readdirSync(args.path).map(x => `${args.path}/${x}`) : stats.isFile() ? [args.path] : [];

			if (!validCallback || validCallback(stats)) {
				files.forEach((x, i) => {
					fs.readFile(x, async (readFileError, data) => {
						if (readFileError) {
							showConsole(readFileError.message, true, COLORS.red);
						} else {
							const filename = x.substring(x.lastIndexOf("/") + 1, x.lastIndexOf("."));
							const newArgs = files.length > 1 ? { ...args, outputFileName: filename } : args;
	
							await multipleTasks(data.toString(), args.languages, getOutputParameters(newArgs), args.debug, i, files.length - 1)
						}
					});
				})
			} else if (invalidMessage) {
				showConsole(invalidMessage, true, COLORS.red);
			}
		}
	});
}

function getFiles(directory, validations, data) {
	const files = data || [];

    fs.readdirSync(directory).forEach(x => {
		const root = `${directory}/${x}`;
		const folder = fs.statSync(root).isDirectory();

		if (folder) {
			return getFiles(root, validations, files);
		}

		if (!validations || validations(root)) {
			files.push(root);
		}
    });

	return files;
}

function getFolders(directory, validations, data) {
	const files = getFiles(directory, validations, data);
	const folders = files.map(x => x.substring(0, x.lastIndexOf("/")));
	const uniqueValues = folders.filter((x, i, a) => a.indexOf(x) === i);

	return uniqueValues;
}

async function App() {
	const args = await yargs(hideBin(process.argv))
		.command({
			command: "file <path> <l|languages>",
			desc: "use the contents of a file to translate into multiple languages",
			handler: (argv) => basicPathValidation(argv, (stats) => stats.isFile(), "this path is not a valid file")
		})
		.command({
			command: "directory <path> <l|languages>",
			desc: "use content from multiple files to translate into multiple languages",
			handler: (argv) => basicPathValidation(argv, (stats) => stats.isDirectory(), "this path is not a valid directory")
		})
		.command({
			command: "text <text> <l|languages>",
			desc: "use text to translate into multiple languages",
			handler: async (argv) => await multipleTasks(argv.text, argv.languages, getOutputParameters(argv), argv.debug)
		})
		.command({
			command: "dec",
			desc: "delete all files generated by commands",
			handler: async () => {
				const object = {
					notAll: ["dir", "default"],
					notAny: ["CHANGELOG"]
				};
				const folders = getFolders("environments", (dir) => VALIDATIONS.minimumLevel(dir, 3) && VALIDATIONS.directoryContains(dir, object));
				
				folders.forEach(x => {
					showConsole(x, true);
					fs.rmSync(x, { recursive: true, force: true });
				});
			}
		})
		.options({
			"outputDynamicLanguageFolder": {
				alias: "odlf",
				type: "boolean",
				default: DEFAULT_VALUES.outputDynamicLanguageFolder
			},
			"outputFileDirectory": {
				alias: "ofd",
				default: DEFAULT_VALUES.outputFileDirectory
			},
			"outputFileName": {
				alias: "ofn"
			},
			"outputFileExtension": {
				alias: "ofe",
				default: DEFAULT_VALUES.outputFileExtension
			},
			"debug": {
				alias: "d",
				type: "boolean"
			},
			"forced": {
				alias: "f",
				type: "boolean"
			},
			"test": {
				alias: "t",
				type: "boolean"
			}
		})
		.version(false)
		.help(false)
		.demandCommand()
		.parseAsync();

		showConsole(args, args.debug);
}

App();