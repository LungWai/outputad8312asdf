import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';

export interface Rule {
  id: string;
  name: string;
  description: string;
  content: string;
  isGlobal: boolean;
  tags: string[];
  frontmatter: Record<string, any>;
  appliedProjects: string[];
}

export class RuleImpl implements Rule {
  id: string;
  name: string;
  description: string;
  content: string;
  isGlobal: boolean;
  tags: string[];
  frontmatter: Record<string, any>;
  appliedProjects: string[];

  constructor(
    id: string,
    name: string,
    description: string,
    content: string,
    isGlobal: boolean = false,
    tags: string[] = [],
    frontmatter: Record<string, any> = {},
    appliedProjects: string[] = []
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.content = content;
    this.isGlobal = isGlobal;
    this.tags = tags;
    this.frontmatter = frontmatter;
    this.appliedProjects = appliedProjects;
  }

  applyToProject(projectId: string): boolean {
    if (!this.appliedProjects.includes(projectId)) {
      this.appliedProjects.push(projectId);
      return true;
    }
    return false;
  }

  makeGlobal(): void {
    this.isGlobal = true;
  }

  async exportToFile(filePath: string): Promise<boolean> {
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
    } catch (error) {
      console.error(`Error exporting rule to file: ${error}`);
      return false;
    }
  }

  serialize(): Record<string, any> {
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

  static deserialize(data: Record<string, any>): RuleImpl {
    return new RuleImpl(
      data.id,
      data.name,
      data.description,
      data.content,
      data.isGlobal,
      Array.isArray(data.tags) ? data.tags : [],
      data.frontmatter || {},
      Array.isArray(data.appliedProjects) ? data.appliedProjects : []
    );
  }

  static async fromMDCFile(filePath: string): Promise<RuleImpl> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      // Parse frontmatter and content
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      
      if (frontmatterMatch) {
        const [, frontmatterYaml, mdContent] = frontmatterMatch;
        const frontmatter = yaml.parse(frontmatterYaml) || {};
        
        return new RuleImpl(
          `rule-${Date.now()}`,
          frontmatter.name || path.basename(filePath, '.mdc'),
          frontmatter.description || '',
          mdContent.trim(),
          false,
          Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
          frontmatter,
          []
        );
      } else {
        // No frontmatter found, use filename as name
        const fileName = path.basename(filePath, '.mdc');
        return new RuleImpl(
          `rule-${Date.now()}`,
          fileName,
          '',
          content.trim(),
          false,
          [],
          {},
          []
        );
      }
    } catch (error) {
      console.error(`Error reading MDC file: ${error}`);
      throw new Error(`Failed to parse MDC file: ${error}`);
    }
  }
} 