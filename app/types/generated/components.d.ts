import type { Attribute, Schema } from "@strapi/strapi";

export interface BlocksAudio extends Schema.Component {
  collectionName: "components_blocks_audio";
  info: {
    displayName: "Audio";
    icon: "headphone";
    description: "";
  };
  attributes: {
    asset: Attribute.Media & Attribute.Required;
    transcript: Attribute.Text;
  };
}

export interface BlocksImage extends Schema.Component {
  collectionName: "components_blocks_images";
  info: {
    displayName: "Image";
    icon: "landscape";
    description: "";
  };
  attributes: {
    title: Attribute.String & Attribute.Required;
    alt: Attribute.Text & Attribute.Required;
    asset: Attribute.Media & Attribute.Required;
  };
}

export interface BlocksSlideshow extends Schema.Component {
  collectionName: "components_blocks_slideshows";
  info: {
    displayName: "Slideshow";
    icon: "grid";
  };
  attributes: {
    images: Attribute.Media<_, Utils.Expression.True> & Attribute.Required;
  };
}

export interface BlocksText extends Schema.Component {
  collectionName: "components_blocks_texts";
  info: {
    displayName: "Text";
    icon: "pencil";
    description: "";
  };
  attributes: {
    content: Attribute.Blocks & Attribute.Required;
  };
}

export interface BlocksVideo extends Schema.Component {
  collectionName: "components_blocks_videos";
  info: {
    displayName: "Video";
    icon: "play";
  };
  attributes: {
    mux_asset: Attribute.Relation<"blocks.video", "oneToOne", "plugin::mux-video-uploader.mux-asset">;
  };
}

export interface CourseQuizAnswer extends Schema.Component {
  collectionName: "components_course_quiz_answers";
  info: {
    displayName: "Quiz Answer";
    icon: "lightbulb";
    description: "";
  };
  attributes: {
    answer: Attribute.String & Attribute.Required;
    is_correct: Attribute.Boolean & Attribute.Required & Attribute.DefaultTo<false>;
  };
}

export interface CourseQuizQuestion extends Schema.Component {
  collectionName: "components_course_quiz_questions";
  info: {
    displayName: "Quiz Question";
    icon: "information";
    description: "";
  };
  attributes: {
    answers: Attribute.Component<"course.quiz-answer", true>;
    question: Attribute.Text;
    image: Attribute.Media;
  };
}

export interface CourseSection extends Schema.Component {
  collectionName: "components_course_sections";
  info: {
    displayName: "Section";
    icon: "bulletList";
    description: "";
  };
  attributes: {
    title: Attribute.String & Attribute.Required;
    lessons: Attribute.Relation<"course.section", "oneToMany", "api::lesson.lesson">;
    quiz: Attribute.Relation<"course.section", "oneToOne", "api::quiz.quiz">;
  };
}

declare module "@strapi/types" {
  export module Shared {
    export interface Components {
      "blocks.audio": BlocksAudio;
      "blocks.image": BlocksImage;
      "blocks.slideshow": BlocksSlideshow;
      "blocks.text": BlocksText;
      "blocks.video": BlocksVideo;
      "course.quiz-answer": CourseQuizAnswer;
      "course.quiz-question": CourseQuizQuestion;
      "course.section": CourseSection;
    }
  }
}
