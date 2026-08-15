CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`projectId` text NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE restrict ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tags_projectId` ON `tags` (`projectId`);--> statement-breakpoint
CREATE TABLE `task_tags` (
	`taskId` text NOT NULL,
	`tagId` text NOT NULL,
	PRIMARY KEY(`taskId`, `tagId`),
	FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON UPDATE restrict ON DELETE cascade,
	FOREIGN KEY (`tagId`) REFERENCES `tags`(`id`) ON UPDATE restrict ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_task_tags_tagId` ON `task_tags` (`tagId`);