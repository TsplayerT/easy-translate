// NOT SUPPORTED ESM (MODULE TYPE)

const fs = require("fs");
const path = require("path");
const { translate } = require("@vitalets/google-translate-api");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

// https://wikipedia.org/wiki/ANSI_escape_code
const COLORS = {
	yellow: "\x1b[33m%s\x1b[0m",
	cyan: "\x1b[36m%s\x1b[0m",
	white: "\x1b[37m%s\x1b[0m"
};

function showConsole(message, enabled, color) {
	const customColor = color || ["string", "array"].includes(typeof message) && /^.*<.*>.*$/.test(message) && COLORS.white || COLORS.cyan;

	enabled && console.log(customColor, message);
}

function getOutputParameters(values) {
	showConsole("function <getOutputParameters>", values.debug);

	return {
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

async function getTranslate(content, language, debug) {
	showConsole("function <getTranslate>", debug);

	// const { text } = await translate(content, { to: language });
	const text = content;

	showConsole(`[${language}]: ${text}`, debug, COLORS.yellow);

	return text;
}

async function saveValues(outputParameters, data, debug) {
	showConsole("function <saveValues>", debug);

	const { directory, dynamicFolder, name, extension } = outputParameters;

	if (Array.isArray(data) && data.length > 0) {
		data.flatMap(x => Object.entries(x)).forEach(([language, value]) => {
			const customPath = dynamicFolder ? `${directory}/${language}/${name || language}.${extension}` : `${directory}/${name || language}.${extension}`;
			const finalCustomPath = path.dirname(customPath);

			showConsole(`customPath: ${customPath}`, debug);
			showConsole(`finalCustomPath: ${finalCustomPath}`, debug);

			if (!fs.existsSync(finalCustomPath)) {
				showConsole("not exists directory", debug);
		
				fs.mkdirSync(finalCustomPath, { recursive: true }, showError);
				showConsole("create directory", debug);
			}

			fs.writeFileSync(customPath, value, { encoding: "utf-8" });
			
			showConsole("writed file", debug);
		});
	}
}

async function multipleTasks(content, languages, outputParameters, debug) {
	showConsole("function <multipleTasks>", debug);

	const array = !languages.includes(",") ? languages.split(" ") : languages.replaceAll(" ", "").split(",");
	const tasks = array.map(async x => {
		const data = await getTranslate(content, x, debug);

		return { [x]: data };
	});
	const results = await Promise.all(tasks);

	saveValues(outputParameters, results, debug);

	showConsole("√ successfully translated content", true, COLORS.yellow);
}

async function App() {
	const args = await yargs(hideBin(process.argv))
		.command({
			command: "file <directory> <l|languages>",
			desc: "use the contents of a file to translate into multiple languages",
			aliases: ["f"],
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
			aliases: ["t"],
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
			}
		})
		.version(false)
		.help(false)
		.demandCommand()
		.parseAsync();

		showConsole(args, args.debug);
}

App();
