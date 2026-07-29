CREATE TABLE `annotations` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`labelId` text NOT NULL,
	`sampleId` text NOT NULL,
	FOREIGN KEY (`labelId`) REFERENCES `labels`(`id`) ON UPDATE restrict ON DELETE restrict,
	FOREIGN KEY (`sampleId`) REFERENCES `samples`(`id`) ON UPDATE restrict ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_annotations_sampleId` ON `annotations` (`sampleId`);--> statement-breakpoint
CREATE INDEX `idx_annotations_labelId` ON `annotations` (`labelId`);--> statement-breakpoint
CREATE TABLE `annotators` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`headers` text NOT NULL,
	`projectId` text NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE restrict ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_annotators_projectId` ON `annotators` (`projectId`);--> statement-breakpoint
CREATE TABLE `images` (
	`id` text PRIMARY KEY NOT NULL,
	`hash` text NOT NULL,
	`extension` text NOT NULL,
	`width` integer,
	`height` integer
);
--> statement-breakpoint
CREATE TABLE `labels` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`projectId` text NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE restrict ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_labels_projectId` ON `labels` (`projectId`);--> statement-breakpoint
CREATE TABLE `points` (
	`id` text PRIMARY KEY NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`sequence` integer NOT NULL,
	`annotationId` text NOT NULL,
	FOREIGN KEY (`annotationId`) REFERENCES `annotations`(`id`) ON UPDATE restrict ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_points_annotationId` ON `points` (`annotationId`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `samples` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`split` text NOT NULL,
	`createdAt` text NOT NULL,
	`completedAt` text,
	`imageId` text NOT NULL,
	`taskId` text NOT NULL,
	FOREIGN KEY (`imageId`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON UPDATE restrict ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_samples_taskId` ON `samples` (`taskId`);--> statement-breakpoint
CREATE INDEX `idx_samples_imageId` ON `samples` (`imageId`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`projectId` text NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE restrict ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_projectId` ON `tasks` (`projectId`);