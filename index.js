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

function showConsole(message, enabled, color) {
	const customColor = color || ["string", "array"].includes(typeof message) && /^.*<.*>.*$/.test(message) && COLORS.white || COLORS.cyan;

	enabled && console.log(customColor, message);
}

function getOutputParameters(values) {
	showConsole("function <getOutputParameters>", values.debug);

	return {
		...values,
		directory: values.outputFileDirectory,
		dynamicFolder: values.outputDynamicLanguageFolder || false,
		name: values.outputFileName,
		extension: values.outputFileExtension || "txt"
	}
}

function showError(error, path) {
	const message = path ? `[${path}]: ${error}` : error;

	error && console.error(message);
}

async function getTranslate(content, language, debug, test) {
	showConsole("function <getTranslate>", debug);

	try {
		const text = test ? content : await translate(content, { to: language });
		
		showConsole(`[${language}]: ${text}`, debug, COLORS.yellow);
		showConsole(`√ content translated to '${language}'`, true, COLORS.yellow);

		return text;
	} catch (error) {
		if (error.name === "TooManyRequestsError") {
			showConsole(`the amount of translations exceeded the free amount in a short period of time of the Google Translate service, please use a VPN`, true, COLORS.red);

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

async function multipleTasks(content, languages, outputParameters, debug) {
	showConsole("function <multipleTasks>", debug);

	const { forced, test } = outputParameters;

	if (test) {
		showConsole("===================================", true, COLORS.red);
		showConsole("============ TEST MODE ============", true, COLORS.red);
		showConsole("===================================", true, COLORS.red);
	}

	const array = !languages.includes(",") ? languages.split(" ") : languages.replaceAll(" ", "").split(",");
	const tasks = array.map(async x => new Promise(async resolve => {
		// makes it run as a sequential task	
		setTimeout(async () => {
			const data = await getTranslate(content, x, debug, test);

			if (data) {
				const directory = await createDirectory(outputParameters, x, debug, forced);
	
				await createFile(outputParameters, directory, x, data, debug, forced);
	
				resolve({ [x]: data });
			}
		}, 0)

	}));

	const results = await Promise.all(tasks);

	showConsole(results, debug);
	showConsole("===================================", true, COLORS.yellow);
	showConsole("√ operation completed", true, COLORS.yellow);
}

async function App() {
	const args = await yargs(hideBin(process.argv))
		.command({
			command: "file <directory> <l|languages>",
			desc: "use the contents of a file to translate into multiple languages",
			handler: (argv) => fs.readFile(argv.directory, async (error, data) => {
				if (error) {
					console.error(error);
				} else {
					await multipleTasks(data.toString(), argv.languages, getOutputParameters(argv), argv.debug)
				}
			})
		})
		.command({
			command: "text <text> <l|languages>",
			desc: "use text to translate into multiple languages",
			handler: async (argv) => await multipleTasks(argv.text, argv.languages, getOutputParameters(argv), argv.debug)
		})
		.options({
			"outputDynamicLanguageFolder": {
				alias: "odlf",
				type: "boolean",
				default: true
			},
			"outputFileDirectory": {
				alias: "ofd",
				default: "output"
			},
			"outputFileName": {
				alias: "ofn",
			},
			"outputFileExtension": {
				alias: "ofe",
				default: "txt"
			},
			"debug": {
				alias: "d",
				type: "boolean",
				default: false
			},
			"forced": {
				alias: "f",
				type: "boolean",
				default: false
			},
			"test": {
				alias: "t",
				type: "boolean",
				default: false
			}
		})
		.version(false)
		.help(false)
		.demandCommand()
		.parseAsync();

		showConsole(args, args.debug);
}

App();