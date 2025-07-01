"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleImpl = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const yaml = __importStar(require("yaml"));
const logger_1 = require("../utils/logger");
const constants_1 = require("../config/constants");
class RuleImpl {
    constructor(id, name, description, content, isGlobal = false, tags = [], frontmatter = {}, appliedProjects = []) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.content = content;
        this.isGlobal = isGlobal;
        this.tags = tags;
        this.frontmatter = frontmatter;
        this.appliedProjects = appliedProjects;
    }
    applyToProject(projectId) {
        if (!this.appliedProjects.includes(projectId)) {
            this.appliedProjects.push(projectId);
            return true;
        }
        return false;
    }
    makeGlobal() {
        this.isGlobal = true;
    }
    async exportToFile(filePath) {
        try {
            // Prepare frontmatter
            const frontmatterObj = {
                ...this.frontmatter,
                name: this.name,
                description: this.description,
                tags: this.tags
            };
            // Create MDC format with frontmatter and content
            const frontmatterYaml = yaml.stringify(frontmatterObj);
            const fileContent = `---\n${frontmatterYaml}---\n\n${this.content}`;
            // Ensure directory exists
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });
            // Write to file
            await fs.writeFile(filePath, fileContent, 'utf8');
            return true;
        }
        catch (error) {
            logger_1.logger.error(constants_1.LOG_COMPONENTS.RULE_MANAGER, 'Error exporting rule to file', error);
            return false;
        }
    }
    serialize() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            content: this.content,
            isGlobal: this.isGlobal,
            tags: this.tags,
            frontmatter: this.frontmatter,
            appliedProjects: this.appliedProjects
        };
    }
    static deserialize(data) {
        return new RuleImpl(data.id, data.name, data.description, data.content, data.isGlobal, Array.isArray(data.tags) ? data.tags : [], data.frontmatter || {}, Array.isArray(data.appliedProjects) ? data.appliedProjects : []);
    }
    static async fromMDCFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            // Parse frontmatter and content
            const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
            if (frontmatterMatch) {
                const [, frontmatterYaml, mdContent] = frontmatterMatch;
                const frontmatter = yaml.parse(frontmatterYaml) || {};
                return new RuleImpl(`rule-${Date.now()}`, frontmatter.name || path.basename(filePath, '.mdc'), frontmatter.description || '', mdContent.trim(), false, Array.isArray(frontmatter.tags) ? frontmatter.tags : [], frontmatter, []);
            }
            else {
                // No frontmatter found, use filename as name
                const fileName = path.basename(filePath, '.mdc');
                return new RuleImpl(`rule-${Date.now()}`, fileName, '', content.trim(), false, [], {}, []);
            }
        }
        catch (error) {
            logger_1.logger.error(constants_1.LOG_COMPONENTS.RULE_MANAGER, 'Error reading MDC file', error);
            throw new Error(`Failed to parse MDC file: ${error}`);
        }
    }
}
exports.RuleImpl = RuleImpl;
//# sourceMappingURL=rule.js.map