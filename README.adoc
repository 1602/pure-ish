= Pure-ish

Side-effects manager for Javascript apps.

== Theory first: key concepts

=== State is a single source of truth

Application's state is the only thing which prescribes application behaviour. If behaviour of the app must depend on a phase of the moon or your boss's mood then both moon's phase and boss's mood should become registered members of an application state. No accidental state should control application's behaviour. Following this discipline allows to guarantee that application behaviour is determined and predictable.

=== Every transition is data

Want to make http request? Just describe what kind of request you have in mind, don't worry about the rest, it will be done according to spec.

=== Application logic separated from side effects

How do we do certain things is not a concern of application logic, which must be only concern on what do we do and why. How is a distraction and accidental complexity. Let's say there's a single API to everything, which is transition declared in specification.

=== Integration test equals unit test

All principles above leave your application code free of any integrations and external dependencies. We are not testing our external dependencies, right? We're testing our app and it only depends on it's state and talks in specific transitions, these things are essential to an app and can be tested in isolation. You don't need database and swarm of custom microservices running in test mode in order to check that application code is correct.
