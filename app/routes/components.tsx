import { Lesson, UserLessonProgress } from "@prisma/client";

import { IconCamera, IconCameraFilled, IconCertificate, IconDevices, IconDocument } from "~/components/icons";
import { Section, SectionHeader } from "~/components/section";
import { ProgressCircle } from "~/components/sidebar/progress-circle";
import { SectionLesson } from "~/components/sidebar/sidebar-section";
import { ThemeModeToggle } from "~/components/theme-mode-toggle";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { UserMenu } from "~/components/user-menu";

const mockUserLessonProgress: Record<string, UserLessonProgress> = {
  inProgress: {
    id: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    lessonId: "1234-abcd",
    userId: "1234-abcd",
    isCompleted: false,
    durationInSeconds: 120,
  },
  completed: {
    id: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
    lessonId: "1234-abcd",
    userId: "1234-abcd",
    isCompleted: true,
    durationInSeconds: 300,
  },
};

const mockLesson: Lesson = {
  id: "1234-abcd",
  strapiId: 4,
  requiredDurationInSeconds: 300,
  slug: "lesson-title",
  courseId: "1234-abcd",
  createdAt: new Date(),
  updatedAt: new Date(),
};

export default function Components() {
  return (
    <div className="mx-auto mt-48 flex max-w-xl flex-col gap-4 px-12">
      <ThemeModeToggle />
      <Button variant="primary">Primary</Button>
      <Button className="text-" variant="secondary">
        Secondary
      </Button>
      <Section>
        <SectionHeader sectionTitle="Section Title" durationInMinutes={10} />
        <Separator className="my-4" />
        <div className="space-y-6">
          <SectionLesson
            hasVideo={false}
            userProgress={mockUserLessonProgress.inProgress}
            courseSlug="tx-driver-safety"
            lesson={mockLesson}
            lessonTitle="Title"
          />
          <SectionLesson
            hasVideo={false}
            userProgress={mockUserLessonProgress.completed}
            courseSlug="tx-driver-safety"
            lesson={mockLesson}
            lessonTitle="Title"
          />
          <SectionLesson
            hasVideo
            userProgress={mockUserLessonProgress.completed}
            courseSlug="tx-driver-safety"
            lesson={mockLesson}
            lessonTitle="Title"
          />
        </div>
      </Section>
      <UserMenu />
      <p>Here is some text to select</p>
      <IconCameraFilled className="size-8 text-success" />
      <IconCamera className="size-8" />
      <IconCertificate className="size-8" />
      <IconDevices className="size-8" />
      <IconDocument className="size-8" />
      <IconDocument className="size-8 text-primary" />
      <div className="flex flex-wrap items-center gap-2">
        <ProgressCircle ariaLabelledby="x" percentage={0} />
        <ProgressCircle ariaLabelledby="x" percentage={15} />
        <ProgressCircle ariaLabelledby="x" percentage={25} />
        <ProgressCircle ariaLabelledby="x" percentage={35} />
        <ProgressCircle ariaLabelledby="x" percentage={50} />
        <ProgressCircle ariaLabelledby="x" percentage={75} />
        <ProgressCircle ariaLabelledby="x" percentage={100} />
      </div>
      <button className="rounded-full bg-success px-4 py-2 font-bold text-success-foreground">Success button</button>
      <h1>H1</h1>
      <h2>H2</h2>
      <h3>H3</h3>
      <h4>H4</h4>
      <h5>H5</h5>
      <p>Body</p>
      <label htmlFor="id">Label</label>
      <div className="grid size-32 place-items-center border border-foreground bg-background text-lg font-bold">
        <span className="text-foreground">Foreground</span>
      </div>
      <div className="grid size-32 place-items-center bg-foreground text-lg font-bold">
        <span className="text-background">Foreground</span>
      </div>
      <div className="grid size-32 place-items-center bg-success text-lg font-bold">
        <span className="text-success-foreground">Success</span>
      </div>
      <div className="grid size-32 place-items-center bg-primary text-lg font-bold">
        <span className="text-primary-foreground">Primary</span>
      </div>
      <div className="grid size-32 place-items-center bg-secondary text-lg font-bold">
        <span className="text-secondary-foreground">Secondary</span>
      </div>
      <div className="grid size-32 place-items-center bg-destructive text-lg font-bold">
        <span className="text-destructive-foreground">Destructive</span>
      </div>
      <div className="grid size-32 place-items-center bg-muted text-lg font-bold">
        <span className="text-muted-foreground">Muted</span>
      </div>
      <div className="grid size-32 place-items-center bg-accent text-lg font-bold">
        <span className="text-accent-foreground">Accent</span>
      </div>
      <div className="grid size-32 place-items-center bg-popover text-lg font-bold">
        <span className="text-popover-foreground">Popover</span>
      </div>
      <div className="grid size-32 place-items-center bg-card text-lg font-bold">
        <span className="text-card-foreground">Card</span>
      </div>
    </div>
  );
}
