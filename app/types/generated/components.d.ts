import type { Schema, Attribute } from '@strapi/strapi';

export interface BlocksAudio extends Schema.Component {
  collectionName: 'components_blocks_audio';
  info: {
    displayName: 'Audio';
    icon: 'headphone';
    description: '';
  };
  attributes: {
    asset: Attribute.Media & Attribute.Required;
    transcript: Attribute.Text;
    uuid: Attribute.UID &
      Attribute.CustomField<'plugin::strapi-advanced-uuid.uuid'>;
  };
}

export interface BlocksImage extends Schema.Component {
  collectionName: 'components_blocks_images';
  info: {
    displayName: 'Image';
    icon: 'landscape';
    description: '';
  };
  attributes: {
    title: Attribute.String & Attribute.Required;
    alt: Attribute.Text & Attribute.Required;
    asset: Attribute.Media & Attribute.Required;
    uuid: Attribute.UID &
      Attribute.CustomField<'plugin::strapi-advanced-uuid.uuid'>;
  };
}

export interface BlocksText extends Schema.Component {
  collectionName: 'components_blocks_texts';
  info: {
    displayName: 'Text';
    icon: 'pencil';
    description: '';
  };
  attributes: {
    content: Attribute.Blocks & Attribute.Required;
    uuid: Attribute.UID &
      Attribute.CustomField<'plugin::strapi-advanced-uuid.uuid'>;
  };
}

export interface BlocksVideo extends Schema.Component {
  collectionName: 'components_blocks_videos';
  info: {
    displayName: 'Video';
    icon: 'play';
  };
  attributes: {
    mux_asset: Attribute.Relation<
      'blocks.video',
      'oneToOne',
      'plugin::mux-video-uploader.mux-asset'
    >;
  };
}

export interface CourseQuizAnswer extends Schema.Component {
  collectionName: 'components_course_quiz_answers';
  info: {
    displayName: 'Quiz Answer';
    icon: 'lightbulb';
    description: '';
  };
  attributes: {
    answer: Attribute.String & Attribute.Required;
    is_correct: Attribute.Boolean &
      Attribute.Required &
      Attribute.DefaultTo<false>;
  };
}

export interface CourseQuizQuestion extends Schema.Component {
  collectionName: 'components_course_quiz_questions';
  info: {
    displayName: 'Quiz Question';
    icon: 'information';
  };
  attributes: {
    answers: Attribute.Component<'course.quiz-answer', true>;
    question: Attribute.Text;
    question_type: Attribute.Enumeration<['Choose One', 'Multiple Choice']> &
      Attribute.Required &
      Attribute.DefaultTo<'Choose One'>;
  };
}

export interface CourseSection extends Schema.Component {
  collectionName: 'components_course_sections';
  info: {
    displayName: 'Section';
    icon: 'layer';
    description: '';
  };
  attributes: {
    lessons: Attribute.Relation<
      'course.section',
      'oneToMany',
      'api::lesson.lesson'
    >;
    title: Attribute.String & Attribute.Required;
    quiz: Attribute.Relation<'course.section', 'oneToOne', 'api::quiz.quiz'>;
    uuid: Attribute.UID &
      Attribute.CustomField<'plugin::strapi-advanced-uuid.uuid'>;
  };
}

declare module '@strapi/types' {
  export module Shared {
    export interface Components {
      'blocks.audio': BlocksAudio;
      'blocks.image': BlocksImage;
      'blocks.text': BlocksText;
      'blocks.video': BlocksVideo;
      'course.quiz-answer': CourseQuizAnswer;
      'course.quiz-question': CourseQuizQuestion;
      'course.section': CourseSection;
    }
  }
}
