"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptImpl = exports.VariableImpl = void 0;
class VariableImpl {
    constructor(id, name, description, defaultValue = '') {
        this.id = id;
        this.name = name;
        this.description = description;
        this.defaultValue = defaultValue;
    }
    serialize() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            defaultValue: this.defaultValue
        };
    }
    static deserialize(data) {
        return new VariableImpl(data.id, data.name, data.description, data.defaultValue);
    }
}
exports.VariableImpl = VariableImpl;
class PromptImpl {
    constructor(id, title, template, variables = [], created = new Date(), usageCount = 0, category = '', tags = []) {
        this.id = id;
        this.title = title;
        this.template = template;
        this.variables = variables;
        this.created = created;
        this.usageCount = usageCount;
        this.category = category;
        this.tags = tags;
    }
    fillTemplate(values) {
        let filled = this.template;
        // Replace all variables with their values
        this.variables.forEach(variable => {
            const value = values[variable.name] || variable.defaultValue;
            // Use regex to find all occurrences of {{variable.name}} (with possible spaces)
            const regex = new RegExp(`{{\\s*${variable.name}\\s*}}`, 'g');
            filled = filled.replace(regex, value);
        });
        return filled;
    }
    addVariable(variable) {
        // Check if variable with same name exists
        if (!this.variables.some(v => v.name === variable.name)) {
            this.variables.push(variable);
        }
    }
    removeVariable(variableId) {
        const initialLength = this.variables.length;
        this.variables = this.variables.filter(v => v.id !== variableId);
        return this.variables.length !== initialLength;
    }
    incrementUsage() {
        this.usageCount += 1;
    }
    serialize() {
        return {
            id: this.id,
            title: this.title,
            template: this.template,
            variables: this.variables.map(v => v instanceof VariableImpl ? v.serialize() : v),
            created: this.created.toISOString(),
            usageCount: this.usageCount,
            category: this.category,
            tags: this.tags
        };
    }
    static deserialize(data) {
        return new PromptImpl(data.id, data.title, data.template, Array.isArray(data.variables)
            ? data.variables.map((v) => VariableImpl.deserialize(v))
            : [], new Date(data.created), data.usageCount || 0, data.category || '', Array.isArray(data.tags) ? data.tags : []);
    }
    // Extracts variables from template string
    static extractVariablesFromTemplate(template) {
        const matches = template.match(/{{(\s*[\w\d]+\s*)}}/g);
        if (!matches) {
            return [];
        }
        // Extract variable names and remove duplicates
        return [...new Set(matches.map(match => {
                // Extract the variable name without {{ }} and trim whitespace
                return match.replace(/{{|}}/g, '').trim();
            }))];
    }
}
exports.PromptImpl = PromptImpl;
//# sourceMappingURL=prompt.js.map