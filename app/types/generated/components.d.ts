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

export interface PageContentFaq extends Schema.Component {
  collectionName: "components_page_content_faqs";
  info: {
    displayName: "faq";
    icon: "question";
  };
  attributes: {
    question: Attribute.String & Attribute.Required;
    answer: Attribute.Text & Attribute.Required;
  };
}

export interface PageContentFeatureCard extends Schema.Component {
  collectionName: "components_page_content_feature_cards";
  info: {
    displayName: "feature-card";
    icon: "file";
    description: "";
  };
  attributes: {
    title: Attribute.String;
    subtitle: Attribute.String;
  };
}

export interface PageContentFeature extends Schema.Component {
  collectionName: "components_page_content_features";
  info: {
    displayName: "Feature";
    description: "";
  };
  attributes: {
    title: Attribute.String;
    subtitle: Attribute.String;
    icon: Attribute.String & Attribute.Required;
  };
}

export interface PageContentModuleCard extends Schema.Component {
  collectionName: "components_page_content_module_cards";
  info: {
    displayName: "Module Card";
    icon: "";
  };
  attributes: {
    title: Attribute.String;
    subtitle: Attribute.String;
    description: Attribute.String;
    button_text: Attribute.String;
  };
}

export interface PageContentSlide extends Schema.Component {
  collectionName: "components_page_content_slides";
  info: {
    displayName: "Slide";
    icon: "picture";
  };
  attributes: {
    image: Attribute.Media & Attribute.Required;
    title: Attribute.String & Attribute.Required;
    subtitle: Attribute.String;
    description: Attribute.String;
  };
}

export interface PageContentText extends Schema.Component {
  collectionName: "components_page_content_texts";
  info: {
    displayName: "text";
  };
  attributes: {};
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
      "page-content.faq": PageContentFaq;
      "page-content.feature-card": PageContentFeatureCard;
      "page-content.feature": PageContentFeature;
      "page-content.module-card": PageContentModuleCard;
      "page-content.slide": PageContentSlide;
      "page-content.text": PageContentText;
    }
  }
}
